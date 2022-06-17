import {
  errorMessage,
  hasOwnProperties,
  hasOwnProperty,
  isRecord,
  PayloadConverterError,
  ValueError,
} from '@temporalio/internal-workflow-common';
import * as protoJsonSerializer from 'proto3-json-serializer';
import type { Message, Namespace, Root, Type } from 'protobufjs';
// import protobufjs from 'protobufjs/light';
import { PayloadConverterWithEncoding } from './payload-converters';
import {
  EncodingType,
  encodingTypes,
  METADATA_ENCODING_KEY,
  METADATA_MESSAGE_TYPE_KEY,
  Payload,
  str,
  u8,
} from './types';

const protobufjs = { roots: {} };

abstract class ProtobufPayloadConverter implements PayloadConverterWithEncoding {
  protected readonly root: Root | undefined;
  public abstract encodingType: EncodingType;

  public abstract toPayload<T>(value: T): Payload | undefined;
  public abstract fromPayload<T>(payload: Payload): T;

  // Don't use type Root here because root.d.ts doesn't export Root, so users would have to type assert
  constructor(root?: unknown) {
    if (root) {
      if (!isRoot(root)) {
        throw new TypeError('root must be an instance of a protobufjs Root');
      }

      this.root = root;
    }
  }

  protected validatePayload(content: Payload): { messageType: Type; data: Uint8Array } {
    if (content.data === undefined || content.data === null) {
      throw new ValueError('Got payload with no data');
    }
    if (!content.metadata || !(METADATA_MESSAGE_TYPE_KEY in content.metadata)) {
      throw new ValueError(`Got protobuf payload without metadata.${METADATA_MESSAGE_TYPE_KEY}`);
    }

    const messageTypeName = str(content.metadata[METADATA_MESSAGE_TYPE_KEY]);
    let messageType;
    if (this.root) {
      try {
        messageType = this.root.lookupType(messageTypeName);
      } catch (e) {
        if (errorMessage(e)?.includes('no such type')) {
          throw new PayloadConverterError(
            `Got a \`${messageTypeName}\` protobuf message but cannot find corresponding message class in \`root\``
          );
        }

        throw e;
      }
    } else {
      const roots = protobufjs.roots && Object.entries(protobufjs.roots);
      if (!roots || !roots.length) {
        console.log('AAAAAA', protobufjs.roots);
        throw new PayloadConverterError(
          `Got a \`${messageTypeName}\` protobuf message but cannot find any ProtobufJS message roots. Make sure to follow the protobuf docs and import \`root.js\` in your Workflow and Activity code. https://docs.temporal.io/typescript/data-converters#protobufs`
        );
      }

      // for (const [_name, root] of roots) {
      //   try {
      //     messageType = root.lookupType(messageTypeName);
      //   } catch (err) {
      //     const message = errorMessage(err);
      //     if (!message || !/no such type/.test(message)) {
      //       throw err;
      //     }
      //   }

      //   if (messageType) {
      //     break;
      //   }
      // }
      if (!messageType) {
        throw new PayloadConverterError(
          `Got a \`${messageTypeName}\` protobuf message but cannot find corresponding message class in ProtobufJS message roots. Make sure that \`${messageTypeName}\` is included in the \`.proto\` files used to generate \`json-module.js\` and \`root.d.ts\`. https://docs.temporal.io/typescript/data-converters#protobufs`
        );
      }
    }

    return { messageType, data: content.data };
  }

  protected constructPayload({ messageTypeName, message }: { messageTypeName: string; message: Uint8Array }): Payload {
    return {
      metadata: {
        [METADATA_ENCODING_KEY]: u8(this.encodingType),
        [METADATA_MESSAGE_TYPE_KEY]: u8(messageTypeName),
      },
      data: message,
    };
  }
}

/**
 * Converts between protobufjs Message instances and serialized Protobuf Payload
 */
export class ProtobufBinaryPayloadConverter extends ProtobufPayloadConverter {
  public encodingType = encodingTypes.METADATA_ENCODING_PROTOBUF;

  /**
   * @param root The value returned from {@link patchProtobufRoot}
   */
  constructor(root?: unknown) {
    super(root);
  }

  public toPayload(value: unknown): Payload | undefined {
    if (!isProtobufMessage(value)) {
      return undefined;
    }

    return this.constructPayload({
      messageTypeName: getNamespacedTypeName(value.$type),
      message: value.$type.encode(value).finish(),
    });
  }

  public fromPayload<T>(content: Payload): T {
    const { messageType, data } = this.validatePayload(content);
    return messageType.decode(data) as unknown as T;
  }
}

/**
 * Converts between protobufjs Message instances and serialized JSON Payload
 */
export class ProtobufJsonPayloadConverter extends ProtobufPayloadConverter {
  public encodingType = encodingTypes.METADATA_ENCODING_PROTOBUF_JSON;

  /**
   * @param root The value returned from {@link patchProtobufRoot}
   */
  constructor(root?: unknown) {
    super(root);
  }

  public toPayload(value: unknown): Payload | undefined {
    if (!isProtobufMessage(value)) {
      return undefined;
    }

    const jsonValue = protoJsonSerializer.toProto3JSON(value);

    return this.constructPayload({
      messageTypeName: getNamespacedTypeName(value.$type),
      message: u8(JSON.stringify(jsonValue)),
    });
  }

  public fromPayload<T>(content: Payload): T {
    const { messageType, data } = this.validatePayload(content);
    return protoJsonSerializer.fromProto3JSON(messageType, JSON.parse(str(data))) as unknown as T;
  }
}

function isProtobufType(type: unknown): type is Type {
  return (
    isRecord(type) &&
    type.constructor.name === 'Type' &&
    hasOwnProperties(type, ['parent', 'name', 'create', 'encode', 'decode']) &&
    typeof type.name === 'string' &&
    typeof type.create === 'function' &&
    typeof type.encode === 'function' &&
    typeof type.decode === 'function'
  );
}

function isProtobufMessage(value: unknown): value is Message {
  return isRecord(value) && hasOwnProperty(value, '$type') && isProtobufType(value.$type);
}

function getNamespacedTypeName(node: Type | Namespace): string {
  if (node.parent && !isRoot(node.parent)) {
    return getNamespacedTypeName(node.parent) + '.' + node.name;
  } else {
    return node.name;
  }
}

function isRoot(root: unknown): root is Root {
  return isRecord(root) && root.constructor.name === 'Root';
}
