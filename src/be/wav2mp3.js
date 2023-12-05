const lamejs = require("lamejstmp");
const { workerData, parentPort } = require("node:worker_threads");
const { path, channels } = workerData;
const sampleRate = 44100; //44.1khz (normal mp3 samplerate)
const kbps = 320;
const mp3encoder = new lamejs.Mp3Encoder(channels.length, sampleRate, kbps);
const sampleBlockSize = 115200 * 2;
var mp3Data = [];
var mp3len = 0;
for (var i = 0; i < channels[0].length; i += sampleBlockSize) {
  parentPort.postMessage({ progress: i / channels[0].length });
  const leftChunk = channels[0].subarray(i, i + sampleBlockSize);
  if (channels.length > 1) {
    const rightChunk = channels[1].subarray(i, i + sampleBlockSize);
    var mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3len += mp3buf.length;
      mp3Data.push(Buffer.from(mp3buf));
    }
  } else {
    var mp3buf = mp3encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) {
      mp3len += mp3buf.length;
      mp3Data.push(Buffer.from(mp3buf));
    }
  }
}
var mp3buf = mp3encoder.flush(); //finish writing mp3
if (mp3buf.length > 0) {
  mp3len += mp3buf.length;
  mp3Data.push(Buffer.from(mp3buf));
}
var mp3data = Buffer.concat(mp3Data, mp3len);
require("fs").writeFileSync(path, mp3data);
