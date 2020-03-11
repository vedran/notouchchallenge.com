let forwardTimes = [];
let handTrackModel = null;
let handTrackingReady = false;
const videoEl = $("#inputVideo").get(0);
let faceTrackingDims = null;
let lastFaceTrackingDims = null;
let lastFaceResults = null;
let hands = [];
let faceSkipCount = 0;

function faceTrackingReady() {
  return !!faceapi.nets.tinyFaceDetector.params;
}

const faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 128,
  scoreThreshold: 0.5
});

async function processFaceTracking() {
  if (!faceTrackingReady()) {
    return;
  }

  if (handTrackingReady) {
    faceSkipCount += 1;

    if (faceSkipCount < 7) {
      return;
    }
  }

  faceSkipCount = 0;

  const result = await faceapi.detectSingleFace(videoEl, faceDetectorOptions);

  if (result) {
    const canvas = $("#facetrack").get(0);
    if (faceTrackingDims && !lastFaceTrackingDims) {
      videoEl.width = $("#inputVideo").width(); //faceTrackingDims.width;
      videoEl.height = $("#inputVideo").height(); //faceTrackingDims.width;

      $("#handtrack").attr("width", $("#inputVideo").width());
      $("#handtrack").attr("height", $("#inputVideo").height());

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

  hands = predictionsToHands(predictions);

  drawPredictions(hands, canvas);
}

function predictionsToHands(predictions) {
  const newHands = [...hands];

  predictions.map(function(prediction) {
    const center = {
      x: prediction.bbox[0] + prediction.bbox[2] / 2,
      y: prediction.bbox[1] + prediction.bbox[3] / 2
    };

    // Find the closest hand to this center
    const closestHand = hands.find(function(lastHand) {
      const a = lastHand.center.x - center.x;
      const b = lastHand.center.y - center.y;
      const dist = Math.sqrt(a * a + b * b);

      return dist < 60;
    });

    if (closestHand) {
      const index = hands.indexOf(closestHand);
      newHands[index] = {
        ...prediction,
        center,
        lastSeenAt: new Date().getTime()
      };
      return;
    }

    // If there isn't a closest hand, then this might be a new hand if it's near the bottom of the frame
    if (center.y > $("#inputVideo").height() * 0.6) {
      newHands.push({
        ...prediction,
        center,
        lastSeenAt: new Date().getTime()
      });
      return;
    }
  });

  return newHands.filter(function(hand) {
    return new Date().getTime() - hand.lastSeenAt < 1000;
  });
}

async function checkForCollisions(predictions) {
  if (!predictions.length) {
    return;
  }
}

async function initFaceTracking() {
  await faceapi.nets.tinyFaceDetector.load("/");
}

async function initHandTracking() {
  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 6, // maximum number of boxes to detect
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
    return setTimeout(() => processFrames(), 50);
  }

  await processFaceTracking();
  await processHandTracking();

  requestAnimationFrame(processFrames);
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
