let handTrackModel = null;
let handTrackingReady = false;
const videoEl = $("#inputVideo").get(0);
let faceTrackingDims = null;
let lastFaceTrackingDims = null;
let lastFaceResults = null;
let hands = [];
let faceSkipCount = 0;
let lastSuccessfulFaceDetection = 0;
let touchedAudio = new Audio("touched.mp3");

let paused = true;
let curTimerInterval = null;
let startedTrackingAt = null;
let finalTime = null;
let restartAfterTouch = false;

function faceTrackingReady() {
  return !!faceapi.nets.tinyFaceDetector.params;
}

const faceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 256,
  scoreThreshold: 0.5
});

async function processFaceTracking() {
  if (!faceTrackingReady()) {
    return;
  }

  if (handTrackingReady) {
    if (new Date().getTime() - lastSuccessfulFaceDetection < 1500) {
      return;
    }
  }

  const result = await faceapi.detectSingleFace(videoEl, faceDetectorOptions);
  const canvas = $("#facetrack").get(0);

  if (result) {
    if (faceTrackingDims && !lastFaceTrackingDims) {
      videoEl.width = $("#inputVideo").width();
      videoEl.height = $("#inputVideo").height();

      $("#handtrack").attr("width", $("#inputVideo").width());
      $("#handtrack").attr("height", $("#inputVideo").height());

      handTrackingReady = true;
    }

    if (!curTimerInterval) {
      startedTrackingAt = new Date().getTime();
      curTimerInterval = setInterval(function() {
        $("#status").html(
          "Timer started. Don't touch your face! Elapsed: " +
            ((new Date().getTime() - startedTrackingAt) / 1000.0).toString()
        );
      }, 100);
    }
    lastFaceTrackingDims = faceTrackingDims;
    faceTrackingDims = faceapi.matchDimensions(canvas, videoEl, true);
    lastFaceResults = faceapi.resizeResults(result, faceTrackingDims);
    faceapi.draw.drawDetections(canvas, lastFaceResults);
    lastSuccessfulFaceDetection = new Date().getTime();
  } else {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
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

  if (didTouchFace()) {
    paused = true;
    hands = [];
    if (touchedAudio.currentTime === 0 || touchedAudio.paused) {
      touchedAudio.play();
    }

    clearInterval(curTimerInterval);
    finalTime = (new Date().getTime() - startedTrackingAt) / 1000.0;

    const restartButton = restartAfterTouch
      ? ""
      : '<button id="restart-btn" onclick="restart()">Try again</button>';

    const keepGoingButton =
      '<button title="Continue after a touch is detected without pausing" id="keep-going-btn" onclick="keepGoing()">Just keep going</button>';

    $("#status").html(
      "You touched your face after  " +
        finalTime.toString() +
        " seconds. " +
        restartButton +
        keepGoingButton +
        "<br />"
    );

    if (restartAfterTouch) {
      setTimeout(function() {
        restart();
      }, 2000);
    }

    startedTrackingAt = null;
    curTimerInterval = null;
    $("overlay").show();
    $("after-touch").show();
    return;
  }
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

      return dist < 200;
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
    if (prediction.bbox[1] > $("#inputVideo").height() * 0.5) {
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

function didTouchFace() {
  if (!hands.length || !lastFaceResults) {
    return false;
  }

  const faceBox = {
    left: lastFaceResults.relativeBox.left * videoEl.width,
    right: lastFaceResults.relativeBox.right * videoEl.width,
    top: lastFaceResults.relativeBox.top * videoEl.height,
    bottom: lastFaceResults.relativeBox.bottom * videoEl.height
  };

  let i;
  for (i = 0; i < hands.length; i++) {
    const hand = hands[i];

    const handPoints = [
      {
        x: hand.bbox[0],
        y: hand.bbox[1]
      },
      {
        x: hand.bbox[0] + hand.bbox[2],
        y: hand.bbox[1]
      },
      {
        x: hand.bbox[0],
        y: hand.bbox[1] + hand.bbox[3]
      },
      {
        x: hand.bbox[0] + hand.bbox[2],
        y: hand.bbox[1] + hand.bbox[3]
      }
    ];

    const found = handPoints.find(function(pt) {
      return (
        pt.x >= faceBox.left &&
        pt.x <= faceBox.right &&
        pt.y >= faceBox.top &&
        pt.y <= faceBox.bottom
      );
    });

    if (found) {
      return true;
    }
  }

  return false;
}

function loadFaceTrackingModel() {
  faceapi.nets.tinyFaceDetector.load("/");
}

function initHandTracking() {
  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 6, // maximum number of boxes to detect
    iouThreshold: 0.6, // ioU threshold for non-max suppression
    scoreThreshold: 0.7 // confidence threshold for predictions.
  };

  handTrack.load(modelParams).then(function(model) {
    handTrackModel = model;
  });
}

async function onVideoReady() {
  processFrames();
}

async function processFrames() {
  if (paused) {
    return;
  }

  if (videoEl.paused || videoEl.ended) {
    return setTimeout(() => processFrames(), 50);
  }

  await processFaceTracking();
  await processHandTracking();

  requestAnimationFrame(processFrames);
}

function restart() {
  start();
  paused = false;
}

function keepGoing() {
  restartAfterTouch = true;
  restart();
}

function start() {
  lastSuccessfulFaceDetection = 0;
  curTimerInterval = null;
  faceTrackingDims = null;
  lastFaceTrackingDims = null;
  lastFaceResults = null;
  hands = [];
  faceSkipCount = 0;
  lastSuccessfulFaceDetection = 0;
  touchedAudio = new Audio("touched.mp3");
  paused = true;
  curTimerInterval = null;
  startedTrackingAt = null;
  finalTime = null;

  $("#notice").hide();
  $("#overlay").hide();
  $(".container").show();
  $("#status").html("Detecting your face...");

  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: false
    })
    .then(function(stream) {
      videoEl.srcObject = stream;
      paused = false;
    });
}

$(document).ready(function() {
  loadFaceTrackingModel();
  initHandTracking();

  const loadingInterval = setInterval(function() {
    if (!handTrackModel || !faceTrackingReady()) {
      return;
    }

    $("#start-btn").html("Let's do it!");
    $("#start-btn").prop("disabled", false);

    clearInterval(loadingInterval);
  }, 300);
});
