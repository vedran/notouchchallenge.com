let forwardTimes = [];
let handTrackModel = null;
let handTrackingReady = false;
const videoEl = $("#inputVideo").get(0);
let faceTrackingDims = null;
let lastFaceTrackingDims = null;
let lastFaceResults = null;

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

async function processFaceTracking() {
  if (!faceTrackingReady()) {
    return;
  }

  const ts = Date.now();
  const result = await faceapi.detectSingleFace(videoEl, faceDetectorOptions);

  updateTimeStats(Date.now() - ts);

  if (result) {
    const canvas = $("#facetrack").get(0);
    if (faceTrackingDims && !lastFaceTrackingDims) {
      videoEl.width = faceTrackingDims.width;
      videoEl.height = faceTrackingDims.height;

      $("#handtrack").attr("width", faceTrackingDims.width);
      $("#handtrack").attr("height", faceTrackingDims.height);

      handTrackingReady = true;
    }
    lastFaceTrackingDims = faceTrackingDims;
    faceTrackingDims = faceapi.matchDimensions(canvas, videoEl, true);
    lastFaceResults = faceapi.resizeResults(result, faceTrackingDims);
    faceapi.draw.drawDetections(canvas, lastFaceResults);
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
  if (!handTrackModel || !handTrackingReady) {
    return;
  }

  const predictions = await handTrackModel.detect(videoEl);
  const canvas = $("#handtrack").get(0);

  // await checkForCollisions(predictions);

  drawPredictions(predictions, canvas);
}

function removeFalseHands(hand) {
  // CHeck if hand's bottom points are inside of face
}

async function checkForCollisions(predictions) {
  if (!predictions.length) {
    return;
  }

  // console.log({ lastFaceResults });
}

async function initFaceTracking() {
  await faceapi.nets.tinyFaceDetector.load("/");
}

async function initHandTracking() {
  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 3, // maximum number of boxes to detect
    iouThreshold: 0.6, // ioU threshold for non-max suppression
    scoreThreshold: 0.8 // confidence threshold for predictions.
  };

  handTrackModel = await handTrack.load(modelParams);
}

async function onVideoReady() {
  processFrames();
}

async function processFrames() {
  if (videoEl.paused || videoEl.ended) {
    return setTimeout(() => processFrames(), 10);
  }

  await processFaceTracking();
  await processHandTracking();

  setTimeout(() => processFrames(), 10);
}

$(document).ready(function() {
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: false
    })
    .then(async function(stream) {
      videoEl.srcObject = stream;

      await initFaceTracking();
      await initHandTracking();
    });
});
