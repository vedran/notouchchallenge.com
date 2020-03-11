let forwardTimes = [];
let handTrackModel = null;
let handTrackingReady = false;
const videoEl = $("#inputVideo").get(0);

function updateTimeStats(timeInMs) {
  forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30);
  const avgTimeInMs =
    forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
  $("#time").val(`${Math.round(avgTimeInMs)} ms`);
  $("#fps").val(`${faceapi.utils.round(1000 / avgTimeInMs)}`);
}

function faceTrackingReady() {
  return !!faceapi.nets.tinyFaceDetector.params;
}

const faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.5
});

async function onVideoReady() {
  if (videoEl.paused || videoEl.ended) {
    return setTimeout(() => onVideoReady(), 10);
  }

  await processFaceTracking();
  await processHandTracking();

  setTimeout(() => onVideoReady(), 100);
}

async function processFaceTracking() {
  if (!faceTrackingReady()) {
    return;
  }

  const ts = Date.now();
  const result = await faceapi.detectSingleFace(videoEl, faceDetectorOptions);

  updateTimeStats(Date.now() - ts);

  if (result) {
    const canvas = $("#facetrack").get(0);
    const dims = faceapi.matchDimensions(canvas, videoEl, true);
    // const dims = {
    //   width: $("#inputVideo").width(),
    //   height: $("#inputVideo").height()
    // };
    faceapi.draw.drawDetections(canvas, faceapi.resizeResults(result, dims));
  }
}
function drawPredictions(predictions, canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "10px Arial";

  // console.log('number of detections: ', predictions.length);
  for (let i = 0; i < predictions.length; i++) {
    context.beginPath();
    context.fillStyle = "rgba(255, 255, 255, 0.6)";
    context.fillRect(
      predictions[i].bbox[0],
      predictions[i].bbox[1] - 17,
      predictions[i].bbox[2],
      17
    );
    context.rect(...predictions[i].bbox);

    // draw a dot at the center of bounding box

    context.lineWidth = 1;
    context.strokeStyle = "#0063FF";
    context.fillStyle = "#0063FF"; // "rgba(244,247,251,1)";
    context.fillRect(
      predictions[i].bbox[0] + predictions[i].bbox[2] / 2,
      predictions[i].bbox[1] + predictions[i].bbox[3] / 2,
      5,
      5
    );

    context.stroke();
    context.fillText(
      predictions[i].score.toFixed(3) + " " + " | hand",
      predictions[i].bbox[0] + 5,
      predictions[i].bbox[1] > 10 ? predictions[i].bbox[1] - 5 : 10
    );
  }
}

async function processHandTracking(video) {
  if (!handTrackingReady) {
    return;
  }

  const predictions = await handTrackModel.detect(videoEl);

  if (predictions.length) {
    const canvas = $("#handtrack").get(0);
    drawPredictions(predictions, canvas);
  }
}

async function initFaceTracking() {
  await faceapi.nets.tinyFaceDetector.load("/");
}

async function initHandTracking() {
  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 2, // maximum number of boxes to detect
    iouThreshold: 0.5, // ioU threshold for non-max suppression
    scoreThreshold: 0.8 // confidence threshold for predictions.
  };

  handTrackModel = await handTrack.load(modelParams);
  handTrackingReady = true;
}

async function init() {
  // try to access users webcam and stream the images
  // to the video element
  const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
  videoEl.srcObject = stream;

  await initFaceTracking();
  // videoEl.width = $("#facetrack").width();
  // videoEl.height = $("#facetrack").height();
  // await initHandTracking();
}

$(document).ready(function() {
  init();
});
