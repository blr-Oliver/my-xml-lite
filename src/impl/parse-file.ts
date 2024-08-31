import * as fs from 'fs';
import {EncodingOption, PathLike} from 'fs';
import {HtmlLite} from '../index.js';
import {CodePoints} from '../interfaces/CodePoints.js';
import {Document} from '../interfaces/dom-types.js';
import {UTF8BufferSentinelSource} from './input/UTF8BufferSentinelSource.js';

export function parseFile(path: PathLike, options: EncodingOption, callback: (err: NodeJS.ErrnoException | null, document?: Document) => void) {
  fs.open(path, 'r', 0o444, (err, fd) => {
    if (err) callback(err);
    else {
      fs.stat(path, (err, stats) => {
        if (err) {
          fs.close(fd);
          callback(err);
        } else {
          const size = stats.size;
          const buffer = Buffer.allocUnsafe(size + 1);
          buffer.writeInt8(CodePoints.EOF, size);
          let totalRead = 0;
          read();

          function read() {
            fs.read(fd, buffer, totalRead, size - totalRead, -1, (err, bytesRead, buffer) => {
              if (err) {
                fs.close(fd);
                callback(err);
              } else {
                totalRead += bytesRead;
                if (totalRead < size) read();
                else {
                  fs.close(fd);
                  callback(err, HtmlLite.parse(new UTF8BufferSentinelSource(buffer)));
                }
              }
            });
          }
        }
      });
    }
  });
}