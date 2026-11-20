
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const carImage = new Image()
carImage.src = "ford_escort.png"

const keys = {};

const car = {
    x: -3645.496759939156,
    y: 3579.3857002296095,
    angle: -0.7609929086291238,
    vx: 0,
    vy: 0
};

const camera = {
    x: -3645.496759939156,
    y: 3579.3857002296095,
    smoothness: 5,
    shake: 0,
    shakeX: 0,
    shakeY: 0
};

const settings = {
    acceleration: 280,
    braking: 450,
    maxSpeed: 420,
    steering: 2.2,
    friction: 100
};

let engineRPM = 900
let currentGear = "N"


// Engine audio
let audioContext;
let engineBuffer;
let engineSource;
let engineGain;

let revBuffer
let revSource
let revGain

let engineStarted = false;

async function startEngineAudio() {
    if (engineStarted) return;

    try {
        audioContext = new AudioContext();
        await audioContext.resume()

        const response = await fetch("assets/audio/engine.mp3");
        const audioData = await response.arrayBuffer();

        engineBuffer = await audioContext.decodeAudioData(audioData);

        const revResponse = await fetch("assets/audio/rev.mp3")
        const revData = await revResponse.arrayBuffer()

        revBuffer = await audioContext.decodeAudioData(revData)

        
        engineSource = audioContext.createBufferSource();
        engineGain = audioContext.createGain();

        engineSource.buffer = engineBuffer;
        engineSource.loop = true;

        engineSource.connect(engineGain);
        engineGain.connect(audioContext.destination);

        
        revSource = audioContext.createBufferSource();
        revGain = audioContext.createGain();

        revSource.buffer = revBuffer;
        revSource.loop = true;

        revSource.connect(revGain);
        revGain.connect(audioContext.destination);

        
        engineGain.gain.value = 0.12;
        revGain.gain.value = 0;

        
        engineSource.start(0);
        revSource.start(0);

        engineStarted = true;

    } catch (error) {
        console.error("Engine audio error:", error);
    }
}

document.addEventListener("keydown", startEngineAudio);
document.addEventListener("pointerdown", startEngineAudio);

const surface = {
    tarmac: {
        acceleration: 340,
        grip: 12,
        drag: 0.45,
        name: "TARMAC"
    },

    gravel: {
        acceleration: 280,
        grip: 5,
        drag: 0.8,
        name: "GRAVEL"
    },

    dirt: {
        acceleration: 250,
        grip: 3.2,
        drag: 1.2,
        name: "DIRT"
    }
};



const rallyStage = {
    state: "waiting",
    startTime: 0,
    finishTime: 0,
    elapsed: 0,

    start: {
    x: -3467.397550281096,
    y: 3434.0417084263777,
    angle: -0.8,
    width: 180
},

    finish: { x: 3786.7712229694903, y: 3124.2713229167143, angle: -0.8, width: 180 }
};

let previousCarPosition = {
    x: car.x,
    y: car.y
}


const STAGE_SCALE = 4;
const STAGE_SIZE = 2048;
const STAGE_ORIGIN = -4096;

const stageBackground = new Image();
const stageRoad = new Image();

let backgroundLoaded = false;
let roadLoaded = false;
let stageReady = false;
let roadMaskData = null;

let surfaceOverride = null;

stageBackground.crossOrigin = "anonymous";
stageBackground.src = "stage_background_image.png";

stageBackground.onload = () => {
    backgroundLoaded = true;
    stageReady = backgroundLoaded && roadLoaded;
};

stageRoad.onload = () => {
    const maskCanvas = document.createElement("canvas");

    maskCanvas.width = STAGE_SIZE;
    maskCanvas.height = STAGE_SIZE;

    const maskCtx = maskCanvas.getContext("2d")

    maskCtx.drawImage(
        stageRoad,
        0,
        0,
        STAGE_SIZE,
        STAGE_SIZE
    );

    roadMaskData = maskCtx.getImageData(
        0,
        0,
        STAGE_SIZE,
        STAGE_SIZE
    ).data;

    roadLoaded = true;
    stageReady = backgroundLoaded && roadLoaded;
}

stageRoad.crossOrigin = "anonymous";
stageRoad.src = "road_layer.png"





let currentSurface = "gravel";

//driving effects

let dustParticles = []
let dustSpawnTimer = 0

//tire skid marks

let skidMarks = []
let lastSkidPositions = [null,null]

//suspension movement
let suspensionTime = 0
let suspensionBounce = 0
let suspensionRoll = 0

//functions

function updateDrivingEffects(dt) {
    const speed = Math.hypot(car.vx, car.vy)
    const handbrake = keys[" "]

    if (speed > 35 && (currentSurface === "gravel" || currentSurface === "dirt")) {
        const forwardX = Math.cos(car.angle)
        const forwardY = Math.sin(car.angle)

        const sideX = -forwardY
        const sideY = forwardX

        const lateralSpeed = Math.abs(car.vx * sideX + car.vy * sideY)

        const intensity = handbrake || lateralSpeed > 35 ? 1 : 0.35

        dustSpawnTimer += dt * (12 + intensity * 25)

        while (dustSpawnTimer >= 1) {
            dustSpawnTimer--

            const side = Math.random() < 0.5 ? -1 : 1

            dustParticles.push({
                x: car.x - forwardX * 25 + sideX * side * 12,
                y: car.y - forwardY * 25 + sideY * side * 12,

                vx: car.vx * 0.2 - forwardX * (15 + Math.random() * 25),
                vy: car.vy * 0.2 - forwardY * (15 + Math.random() * 25),

                life: 0.6 + Math.random() * 0.5,
                maxLife: 1.1,
                size: 4 + Math.random() * 7,
                color: currentSurface === "dirt" ? "#8b7555" : "#c2ad83"
            })
        }
    }

    for (const particle of dustParticles) {
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt

        particle.vx *= Math.exp(-2 * dt)
        particle.vy *= Math.exp(-2* dt)

        particle.life -= dt
        particle.size += 5 *dt
    }

    dustParticles = dustParticles.filter(p => p.life > 0)
}

function updateSkidMarks(dt) {
    const speed = Math.hypot(car.vx, car.vy)
    const handbrake = keys[" "]

    const forwardX = Math.cos(car.angle)
    const forwardY = Math.sin(car.angle)

    const sideX = -forwardY
    const sideY = forwardX

    const lateralSpeed = Math.abs(
        car.vx * sideX + car.vy * sideY
    )

    const isSkidding = 
        speed > 70 &&
        (handbrake || lateralSpeed > 45) &&
        (currentSurface === "gravel" || currentSurface === "dirt")

    if (!isSkidding) {
        lastSkidPositions = [null,null]
        return
    }

    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1

        const position = {
            x: car.x - forwardX * 16 + sideX * side * 10,
            y: car.y - forwardY * 16 + sideY * side * 10
        }

        if (lastSkidPositions[1]) {
            skidMarks.push({
                x1: lastSkidPositions[i].x,
                y1: lastSkidPositions[i].y,
                x2: position.x,
                y2: position.y,
                life: 8,
                maxLife: 8,
                color: currentSurface === "dirt"
                    ? "#514331"
                    : "#76664e"
            })
        }
        lastSkidPositions[i] = position
    }
    for (const mark of skidMarks) {
        mark.life -= dt
    }
    skidMarks = skidMarks.filter(mark => mark.life > 0)
}

function updateSuspension(dt) {
    const speed = Math.hypot(car.vx, car.vy)

    const forwardX = Math.cos(car.angle)
    const forwardY = Math.sin(car.angle)

    const sideX = -forwardY
    const sideY = forwardX

    const lateralSpeed = car.vx * sideX + car.vy * sideY

    let roughness = 0
    
    if (currentSurface === "dirt") {
        roughness = 1
    } else if (currentSurface === "gravel") {
        roughness = 0.5
    }

    const speedFactor = Math.min(speed / 180, 1)

    suspensionTime += dt*(4 + speed * 0.025)

    const bumpWave = Math.sin(suspensionTime * 2) +
        Math.sin(suspensionTime * 3.7) * 0.4

    const targetBounge = bumpWave * roughness * speedFactor * 1.5

    const targetRoll = Math.max(
        -0.04,
        Math.min(0.04, -lateralSpeed * 0.00035)
    )

    suspensionBounce += (targetBounge - suspensionBounce) * (1 - Math.exp(-8 * dt))
}

function drawSkidMarks () {
    for (const mark of skidMarks) {
        ctx.globalAlpha = (mark.life / mark.maxLife * 0.65)
        ctx.strokeStyle = mark.color
        ctx.lineWidth = 3
        ctx.lineCap = "round"

        ctx.beginPath()
        ctx.moveTo(mark.x1, mark.y1)
        ctx.lineTo(mark.x2, mark.y2)
        ctx.stroke()
    }

    ctx.globalAlpha = 1
}

function drawDrivingEffects() {
    for (const particle of dustParticles) {
        const alpha = Math.max(0, particle.life / particle.maxLife)

        ctx.globalAlpha = alpha * 0.55

        ctx.fillStyle = particle.color
        
        ctx.beginPath()
        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        )
        ctx.fill()
    }
    ctx.globalAlpha = 1
}


let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;
let lastTime = 0;

function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === "1") currentSurface = "tarmac";
    if (e.key === "2") currentSurface = "gravel";
    if (e.key === "3") currentSurface = "dirt";
    if (e.key === "0") currentSurface = null;
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});


function isOnRoad(x, y) {
    if (!roadMaskData) return true;

    const px = Math.floor(
        (x - STAGE_ORIGIN) / STAGE_SCALE
    )

    const py = Math.floor (
        (y - STAGE_ORIGIN) / STAGE_SCALE
    )

    if (
        px <= 0 ||
        py <= 0 ||
        px >= STAGE_SIZE ||
        py >= STAGE_SIZE
    ) {
        return false;
    }

    const index = (py * STAGE_SIZE + px) * 4;

    return roadMaskData[index + 3] > 100

}


function crossedGate(gate, previous, current) {
    const nx = Math.cos(gate.angle);
    const ny = Math.sin(gate.angle);

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;

    const oldSide =
        (previous.x - gate.x) * nx +
        (previous.y - gate.y) * ny;

    const newSide =
        (current.x - gate.x) * nx +
        (current.y - gate.y) * ny;

    // Must actually cross the gate plane
    if (oldSide >= 0 || newSide < 0) {
        return false;
    }

    const denominator = oldSide - newSide;

    if (Math.abs(denominator) < 0.0001) {
        return false;
    }

    const t = oldSide / denominator;

    const crossX = previous.x + dx * t;
    const crossY = previous.y + dy * t;

    const lateralX = -ny;
    const lateralY = nx;

    const lateralDistance = Math.abs(
        (crossX - gate.x) * lateralX +
        (crossY - gate.y) * lateralY
    );

    return lateralDistance <= gate.width / 2;
}

function updateRallyStage() {
    const current = {
        x:car.x,
        y:car.y
    }

    if (rallyStage.state === "waiting") {
        if (crossedGate(
            rallyStage.start,
            previousCarPosition,
            current
        )) {
            rallyStage.state = "running"
            rallyStage.startTime = performance.now()
        }
    }

    else if (rallyStage.state === "running") {
        rallyStage.elapsed = 
            (performance.now() - rallyStage.startTime) / 1000


        if (crossedGate(
            rallyStage.finish,
            previousCarPosition,
            current
        )) {
            rallyStage.state = "finished"
            rallyStage.finishTime = rallyStage.elapsed
        }
    }

    previousCarPosition = current
}

function updateEngineSound() {
    if (!engineStarted || !audioContext) return;

    const speed = Math.hypot(car.vx, car.vy);
    const speedRatio = Math.min(speed / settings.maxSpeed, 1);

    const throttle = keys["w"] || keys["ArrowUp"] ? 1: 0

    engineSource.playbackRate.setTargetAtTime(
        0.85 + speedRatio * 0.4,
        audioContext.currentTime,
        0.08
    );

    revSource.playbackRate.setTargetAtTime(
        0.8 + speedRatio * 0.8,
        audioContext.currentTime,
        0.08
    )

    engineGain.gain.setTargetAtTime(
        0.12 * (1 - throttle * 0.5),
        audioContext.currentTime,
        0.12
    );

    revGain.gain.setTargetAtTime(
        throttle * 0.12,
        audioContext.currentTime,
        0.12
    )
}

function updateTransmission(dt) {
    const forwardSpeed = car.vx * Math.cos(car.angle) +
        car.vy * Math.sin(car.angle)
    
    const speedKmh = Math.abs(forwardSpeed) * 0.36

    const accelerating = keys["w"] || keys["arrowup"]
    const reversing = keys["s"] || keys["arrowdown"]

    let targetRPM = 900

    if (forwardSpeed < -2) {
        currentGear = "R"

        targetRPM = 1100 + Math.min(speedKmh / 40,1) * 5000 + (reversing ? 700 : 0)
    } else if (speedKmh < 2 && !accelerating) {
        currentGear = "N"
        targetRPM = 900
    } else {
        if (speedKmh < 35) currentGear = "1"
        else if (speedKmh < 65) currentGear = "2"
        else if (speedKmh < 95) currentGear = "3"
        else if (speedKmh < 125) currentGear = "4"
        else currentGear = "5"

        const gearIndex = Number(currentGear) - 1

        const gearRanges = [
            [0,35],
            [35,65],
            [65,95],
            [95,125],
            [125,160]
        ]

        const [minSpeed, maxSpeed] =  gearRanges[gearIndex]

        const progress = Math.max(0, Math.min(1, (speedKmh - minSpeed) / (maxSpeed - minSpeed)))

        targetRPM = 1100 + progress * 5900

        if (accelerating) {
            targetRPM += 1800
        }
    }

    targetRPM = Math.min(targetRPM, 7500)

    engineRPM += (targetRPM - engineRPM) * (1-Math.exp(-8 * dt))
}


function update(dt) {
    const accelerating = keys["w"] || keys["arrowup"];
    const braking = keys["s"] || keys["arrowdown"];
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    const handbrake = keys[" "];


    if (surfaceOverride) {
        currentSurface = surfaceOverride;
    } else {
        currentSurface = isOnRoad(car.x, car.y)
            ? "gravel"
            : "dirt";

    }

    const activeSurface = surface[currentSurface];

    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);

    const sideX = -forwardY;
    const sideY = forwardX;

    let forwardSpeed =
        car.vx * forwardX + car.vy * forwardY;

    let lateralSpeed =
        car.vx * sideX + car.vy * sideY;

    // Acceleration
    if (accelerating) {
        car.vx += forwardX * activeSurface.acceleration * dt;
        car.vy += forwardY * activeSurface.acceleration * dt;
    }

    // Braking and reversing
    if (braking) {
        if (forwardSpeed > 5) {
            car.vx -= forwardX * settings.braking * dt;
            car.vy -= forwardY * settings.braking * dt;
        } else {
            car.vx -= forwardX * activeSurface.acceleration * 0.45 * dt;
            car.vy -= forwardY * activeSurface.acceleration * 0.45 * dt;
        }
    }

    // Recalculate velocity
    forwardSpeed =
        car.vx * forwardX + car.vy * forwardY;

    lateralSpeed =
        car.vx * sideX + car.vy * sideY;

    // Surface grip
    let grip = activeSurface.grip;

    if (handbrake) {
        grip *= 0.65;
    }

    // Apply grip and drag
    lateralSpeed *= Math.exp(-grip * dt);
    forwardSpeed *= Math.exp(-activeSurface.drag * dt);

    // Rebuild velocity
    car.vx = forwardX * forwardSpeed + sideX * lateralSpeed;
    car.vy = forwardY * forwardSpeed + sideY * lateralSpeed;

    // Steering
    const steeringInput = (right ? 1 : 0) - (left ? 1 : 0);
    const speedFactor = Math.min(Math.abs(forwardSpeed) / 100, 1);

    if (Math.abs(forwardSpeed) > 3) {
        car.angle +=
            steeringInput *
            settings.steering *
            speedFactor *
            (handbrake ? 1.4 : 1) *
            Math.sign(forwardSpeed) *
            dt;
    }

    // Maximum speed limiter
    const speed = Math.hypot(car.vx, car.vy);

    if (speed > settings.maxSpeed) {
        const scale = settings.maxSpeed / speed;

        car.vx *= scale;
        car.vy *= scale;
    }

    // Move car
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    updateDrivingEffects(dt)
    updateSkidMarks(dt)
    updateSuspension(dt)

    updateTransmission(dt)

    updateCamera(dt);
    updateRallyStage()
    updateEngineSound()
}

function updateCamera(dt) {
    const smoothing = 1 - Math.exp(-camera.smoothness * dt);

    camera.x += (car.x - camera.x) * smoothing;
    camera.y += (car.y - camera.y) * smoothing;

    const speed = Math.hypot(car.vx, car.vy)

    const forwardX = Math.cos(car.angle)
    const forwardY = Math.sin(car.angle)

    const sideX = -forwardY
    const sideY = forwardX

    const lateralSpeed = Math.abs(car.vx * sideX + car.vy * sideY)

    const dirtShake = currentSurface === "dirt"
        ? Math.max(0,Math.min(1, (speed-90) / 220)) * 1.8
        : 0
    
    const slideShake = Math.max(
        0,
        Math.min(1, (lateralSpeed - 35) / 100)
    ) * 1.2

    const targetShake = Math.max(dirtShake, slideShake)

    camera.shake +=
        (targetShake - camera.shake) *
        (1 - Math.exp(-7 * dt))

    camera.shakeX = (Math.random() * 2 - 1) * camera.shake
    camera.shakeY = (Math.random() * 2 - 1) * camera.shake
}

function drawWorld() {
    ctx.fillStyle = "#526b45";

    ctx.fillRect (
        STAGE_ORIGIN,
        STAGE_ORIGIN,
        STAGE_SIZE * STAGE_SCALE,
        STAGE_SIZE * STAGE_SCALE
    );

    if (!stageReady) return;

    ctx.drawImage(
        stageBackground,
        STAGE_ORIGIN,
        STAGE_ORIGIN,
        STAGE_SIZE * STAGE_SCALE,
        STAGE_SIZE * STAGE_SCALE
    );

    
}


function drawCar() {
    if (!carImage.complete || !carImage.naturalWidth) return

    ctx.save()

    ctx.translate(car.x, car.y)

    ctx.rotate(car.angle + Math.PI + suspensionRoll)

    ctx.translate(0, suspensionBounce)

    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.fillRect(-34,-13,76,35)

    ctx.drawImage(
        carImage,
        -38,
        -25.33,
        76,
        50.67
    )

    ctx.restore()
}


function drawRallyGates() {
    function drawGate(gate, color, label) {
        const nx = Math.cos(gate.angle)
        const ny = Math.sin(gate.angle)

        const px = -ny
        const py = nx

        ctx.save()

        ctx.strokeStyle = color
        ctx.lineWidth = 12

        ctx.beginPath()

        ctx.moveTo(
            gate.x - px * gate.width / 2,
            gate.y + py * gate.width / 2
        )

        ctx.stroke()

        ctx.fillStyle = color
        ctx.font = "bold 28px Arial"
        ctx.textAlign = "center"

        ctx.fillText(
            label,
            gate.x,
            gate.y - 35
        )

        ctx.restore()
    }

    drawGate(rallyStage.start, "#36e078", "START")
    drawGate(rallyStage.finish, "#ff4545", "FINISH")
}

function drawHUD() {
    const speed = Math.round(
        Math.hypot(car.vx, car.vy) * 0.36
    )

    const rpmProgress = Math.min(engineRPM / 7500,1)

    //Main dashboard

    ctx.fillStyle = "rgba(10, 12, 15, 0.88)"
    ctx.strokeStyle = "rgba(255,255,255,0.18)"
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.roundRect(20,20,330,150,12)
    ctx.fill()
    ctx.stroke

    //speed

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 48px Arial"
    ctx.textAlign = "left"

    ctx.fillText(speed, 42, 83)

    ctx.fillStyle = "#aab0b8"
    ctx.font = "bold 13px Arial"
    ctx.fillText("KM/H", 45, 108)

    //Gear

    ctx.fillStyle = "rgba(255,255,255,0.08)"
    ctx.beginPath()
    ctx.roundRect(255, 42, 72, 72, 8)
    ctx.fill()

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 42px Arial"
    ctx.textAlign = "center"
    ctx.fillText(currentGear, 291, 91)

    ctx.font = "10px Arial"
    ctx.fillStyle = "#aab0b8"
    ctx.fillText("GEAR", 291, 105)

    // rpm

    ctx.textAlign = "left"
    ctx.fillStyle = "#aab0b8"
    ctx.font = "bold 11px Arial"
    ctx.fillText("RPM", 42, 139)

    ctx.fillStyle = "rgba(255,255,255,0.12)"
    ctx.beginPath()
    ctx.roundRect(85, 130, 242, 11, 5)
    ctx.fill()

    ctx.fillStyle = engineRPM > 6500 ? "#ed4545" : "e5e73b"
    ctx.beginPath()
    ctx.roundRect(85,130,242 * rpmProgress, 11, 5)
    ctx.fill()

    //surface type
    ctx.fillStyle = "#aab0b8"
    ctx.font = "bold 11px Arial"

    const surfaceName = surface[currentSurface]?.name ?? "UNKNOWN"

    ctx.fillText("SURFACE: " + surfaceName, 42, 159)

    //stage info
    const panelX = width - 260

    ctx.fillStyle = "rgba(10,12,15,0.88)"
    ctx.strokeStyle = "rgba(255,255,255,0.18)"

    ctx.beginPath()
    ctx.roundRect(panelX, 20, 240, 112, 12)
    ctx.fill()
    ctx.stroke()

    let stageStatus = "WAITING FOR START"

    if (rallyStage.state === "running") {
        stageStatus = "STAGE IN PROGRESS"
    }

    if (rallyStage.state === "finished") {
        stageStatus = "STAGE FINISHED"
    }

    ctx.textAlign = "left"
    ctx.fillStyle = "#aab0b8"
    ctx.font = "bold 13px Arial"
    ctx.fillText("BEYOND THE CREST", panelX + 18, 47)

    ctx.fillStyle ="#ffffff"
    ctx.font = "bold 13px Arial"
    ctx.fillText(stageStatus, panelX + 18,70)

    const time = rallyStage.state === "finished"
        ?rallyStage.finishTime
        : rallyStage.state === "running"
            ?rallyStage.elapsed
            :0
    
    const minutes = Math.floor(time/60)
    const seconds = (time % 60).toFixed(2)

    ctx.font = "bold 27px monospace"
    ctx.fillText(
        `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(5,"0")}`,
        panelX + 18,
        111
    )
}

function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    ctx.save();

    ctx.translate(width / 2, height / 2);
    ctx.scale(1.4, 1.4);
    ctx.translate(
        -camera.x + camera.shakeX,
        -camera.y + camera.shakeY
    );

    drawWorld();
    drawSkidMarks()
    drawDrivingEffects()

    drawCar();

    ctx.restore();

    drawHUD();
}

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.05);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
