const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {};

const car = {
    x: 0,
    y: 0,
    angle: -Math.PI/2,
    speed: 0 
};

const camera = {
    x: 0,
    y: 0,
    smoothness: 5
};

const settings = {
    acceleration:280,
    braking:450,
    maxSpeed:420,
    steering:2.2,
    friction:100
};

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
};

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});

function update(dt) {
    const accelerating = keys["w"] || keys["arrowup"];
    const braking = keys["s"] || keys["arrowdown"];
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    const handbrake = keys[" "];

    if (accelerating) {
        car.speed += settings.acceleration * dt;
    } 

    if (braking) {
        if (car.speed > 0) {
            car.speed -= settings.braking * dt;
        } else {
            car.speed -= settings.acceleration * dt * 0.5;
        }
    }

    if (!accelerating && !braking) {
        if (car.speed > 0) {
            car.speed = Math.max(0, car.speed - settings.friction * dt);
        } else if (car.speed < 0) {
            car.speed = Math.max(0, car.speed + settings.friction * dt);
        }
    }

    car.speed = Math.max(-settings.maxSpeed * 0.35,
        Math.min(settings.maxSpeed, car.speed));


    const steeringInput = (right ? 1:0) - (left ? 1:0);
    const speedFactor = Math.min(Math.abs(car.speed)/120, 1);


    if (Math.abs(car.speed)>5) {
        const handbrakeMultiplier = handbrake ? 1.4 : 1

        car.angle += steeringInput * 
            settings.steering *
            speedFactor *
            handbrakeMultiplier *
            Math.sign(car.speed) * dt;
    }

    if (handbrake) {
        car.speed *= Math.pow(0.985, dt * 60);
    }

    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    updateCamera(dt);
    
}

function updateCamera(dt) {
    const smoothing = 1 - Math.exp(-camera.smoothness * dt);

    camera.x += (car.x - camera.x) * smoothing;
    camera.y += (car.y - camera.y) * smoothing;
}

function drawWorld() {
    ctx.fillStyle = "#526b45";
    ctx.fillRect(-10000, -10000, 20000, 20000);

    //background grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;

    for (let x = -10000; x <= 10000; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, -10000);
        ctx.lineTo(x, 10000);
        ctx.stroke();
    }

    for (let y = - 10000; y <= 10000; y += 100) {
        ctx.beginPath();
        ctx.moveTo(-10000, y);
        ctx.lineTo(10000, y);
        ctx.stroke()
    }

    // Test Rally Road

    ctx.beginPath();
    ctx.moveTo(0, 700);
    ctx.bezierCurveTo(-300, 300, 300, 100, 0, -200);
    ctx.bezierCurveTo(-300, -500, -200, -800, 100, -1100);

    ctx.strokeStyle = "#383b36";
    ctx.lineWidth = 260;
    ctx.lineCap = "round";
    ctx.stroke();


    ctx.strokeStyle = "#a49b83";
    ctx.lineWidth = 250;
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(0, 700);
    ctx.bezierCurveTo(-300, 300, 300, 100, 0, -200);
    ctx.bezierCurveTo(-300, -500, -200, -800, 100, -1100);

}

function drawCar() {
    ctx.save();

    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle + Math.PI / 2);

    //shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-17, 30, 40, 65);

    //body
    ctx.fillStyle = "#e5e5df"
    ctx.fillRect(-19,-35, 38, 70);

    //window
    ctx.fillStyle = "#263b43";
    ctx.fillRect(-15,-20,30,20);

    //rear Window
    ctx.fillRect(-15, 12, 30, 12);

    //headlights
    ctx.fillStyle = "#fff5c4";
    ctx.fillRect(-16, -34, 9, 5);
    ctx.fillRect(7, -34, 9, 5);

    //wheels
    ctx.fillStyle = "#171717"

    ctx.fillRect(-22, -23, 6, 18);
    ctx.fillRect(16, -23, 6, 18);
    ctx.fillRect(-22, 15, 6, 18);
    ctx.fillRect(16, 15, 6, 18);

    ctx.restore();
}

function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(20, 20, 180, 75);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(
        Math.round(Math.abs(car.speed) * 0.36) + " KM/H",
        35, 52
    );

    ctx.font = "13px Arial";
    ctx.fillStyle = "#cccccc"
    ctx.fillText("BEYOND THE CREST", 35, 77);
}

function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    ctx.save();

    ctx.translate(
        width/2 - camera.x,
        height/2 - camera.y
    );

    drawWorld();
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