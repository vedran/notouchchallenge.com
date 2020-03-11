let forwardTimes = [];

function updateTimeStats(timeInMs) {
  forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30);
  const avgTimeInMs =
    forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
  $("#time").val(`${Math.round(avgTimeInMs)} ms`);
  $("#fps").val(`${faceapi.utils.round(1000 / avgTimeInMs)}`);
}

function isFaceDetectionModelLoaded() {
  return !!faceapi.nets.tinyFaceDetector.params;
}

const faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.5
});

async function onPlay() {
  const videoEl = $("#inputVideo").get(0);

  if (videoEl.paused || videoEl.ended || !isFaceDetectionModelLoaded()) {
    return setTimeout(() => onPlay(), 10);
  }

  const ts = Date.now();
  const result = await faceapi.detectSingleFace(videoEl, faceDetectorOptions);

  updateTimeStats(Date.now() - ts);

  if (result) {
    const canvas = $("#facetrack").get(0);
    faceapi.matchDimensions(canvas, videoEl, true);
    const dims = {
      width: $("#inputVideo").width(),
      height: $("#inputVideo").height()
    };
    faceapi.draw.drawDetections(canvas, faceapi.resizeResults(result, dims));
  }

  if (handTrack.isReadyNow) {
    processHandTrack();
  }

  setTimeout(() => onPlay(), 100);
}

async function loadFaceDetector() {
  await faceapi.nets.tinyFaceDetector.load("/");
}

async function initFaceTracking() {
  await loadFaceDetector();
}

let handTrackModel = null;

async function initHandTracking() {
  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 2, // maximum number of boxes to detect
    iouThreshold: 0.5, // ioU threshold for non-max suppression
    scoreThreshold: 0.8 // confidence threshold for predictions.
  };

  handTrackModel = await handTrack.load(modelParams);
  const video = $("#inputVideo").get(0);

  await handTrack.startVideo(video);
  handTrack.isReadyNow = true;
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

async function processHandTrack() {
  const video = $("#inputVideo").get(0);
  const predictions = await handTrackModel.detect(video);

  if (predictions.length) {
    const canvas = $("#handtrack").get(0);
    drawPredictions(predictions, canvas);
  }
}

$(document).ready(function() {
  const videoEl = $("#inputVideo").get(0);
  videoEl.width = 640;
  videoEl.height = 480;

  // try to access users webcam and stream the images
  // to the video element
  navigator.mediaDevices.getUserMedia({ video: {} }).then(function(stream) {
    videoEl.srcObject = stream;

    initHandTracking();
    initFaceTracking();
  });
});
