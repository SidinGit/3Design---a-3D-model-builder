document.addEventListener("DOMContentLoaded", function () {
    var canvas = document.getElementById("renderCanvas");
    var engine = new BABYLON.Engine(canvas, true);
    var firstPointMesh = null;
    var selectedMesh = null;
    var moveButton = document.getElementById("moveButton"); // Store the move button element
    var drawButton = document.getElementById("drawButton"); // Store the draw button element
    var extrudeButton = document.getElementById("extrudeButton"); // Store the extrude button element
    var exitMoveButton = document.getElementById("exitMoveButton"); // Store the exit move button element
    var previousObjects = []; // Store previously drawn objects
    var ground = null;
    var scene = null;
    var camera = null;
    var drawMode = false;
    var drawPoints = [];
    var lines = [];
    var moveMode = false;

    // Disable all buttons except Draw button initially
    extrudeButton.disabled = true;
    moveButton.disabled = true;
    exitMoveButton.disabled = true;
    vertexEditButton.disabled = true;
    var createScene = function () {
        scene = new BABYLON.Scene(engine);

        // Camera setup
        camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 10, BABYLON.Vector3.Zero(), scene);
        camera.lowerRadiusLimit = 5; // Limit camera distance
        camera.upperRadiusLimit = 15;
        camera.attachControl(canvas, false); // Disable camera controls during drawing

        // Light setup
        var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

        // Ground setup
        ground = BABYLON.Mesh.CreateGround("ground", 20, 20, 2, scene);
        ground.material = new BABYLON.StandardMaterial("groundMat", scene);
        ground.material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        ground.material.specularColor = new BABYLON.Color3(0, 0, 0); // Disable light reflection on the ground

        function enterDrawMode() {
            drawMode = true;
            drawPoints = [];
            lines.forEach(function(line) {
                line.dispose();
            });
            lines = [];
            // Clear previously drawn objects
            previousObjects.forEach(function(obj) {
                obj.dispose();
            });
            previousObjects = [];
            // Remove any existing point markers
            if (firstPointMesh) {
                firstPointMesh.dispose();
                firstPointMesh = null;
            }
            // Disable other buttons during drawing
            extrudeButton.disabled = true;
            moveButton.disabled = true;
            exitMoveButton.disabled = true;
        }

        function enterMoveMode() {
            moveMode = true;
            selectedMesh = null;

            // Disable camera rotation control
            camera.inputs.attached.mousewheel.detachControl(canvas);
            camera.inputs.attached.pointers.detachControl(canvas);
            camera.inputs.attached.keyboard.detachControl(canvas);

            // Clear drawing points and lines
            drawPoints = [];
            lines.forEach(function(line) {
                line.dispose();
            });
            lines = [];
            if (firstPointMesh) {
                firstPointMesh.dispose();
                firstPointMesh = null;
            }
            // Clear the 2D sketch mesh
            if (sketchMesh) {
                sketchMesh.dispose();
                sketchMesh = null;
            }
            // Enable exit move button
            exitMoveButton.disabled = false;
            exitMoveButton.classList.add("bright");
        }

        function exitMoveMode() {
            moveMode = false;
            // Enable camera rotation control
            camera.inputs.attached.mousewheel.attachControl(canvas);
            camera.inputs.attached.pointers.attachControl(canvas);
            camera.inputs.attached.keyboard.attachControl(canvas);
            // Disable exit move button
            exitMoveButton.disabled = true;
            exitMoveButton.classList.remove("bright");
        }

        canvas.addEventListener("pointerdown", function (event) {
            if (drawMode && event.button === 0) { // Check for left-click event
                var pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit) {
                    var point = pickResult.pickedPoint.clone();
                    point.y = 0; // Ensure points are on the 2D drawing plane
                    drawPoints.push(point);
                    var line = BABYLON.Mesh.CreateLines("lines", drawPoints, scene);
                    lines.push(line);
                    if (!firstPointMesh) {
                        firstPointMesh = BABYLON.MeshBuilder.CreateSphere("point", { diameter: 0.2 }, scene);
                    }
                    firstPointMesh.position = point;
                    if (drawPoints.length > 1) {
                        // Smoothly adjust camera position to follow the drawing
                        var distance = BABYLON.Vector3.Distance(camera.position, drawPoints[drawPoints.length - 1]);
                        var easeInCubic = new BABYLON.CubicEase();
                        easeInCubic.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEIN);
                        var keys = [];
                        keys.push({ frame: 0, value: camera.position.clone() });
                        keys.push({ frame: 120, value: drawPoints[drawPoints.length - 1].add(new BABYLON.Vector3(0, distance, 0)) });
                        var followAnimation = new BABYLON.Animation("cameraFollowMouse", "position", 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                        followAnimation.setKeys(keys);
                        followAnimation.setEasingFunction(easeInCubic);
                        camera.animations.push(followAnimation);
                        scene.beginAnimation(camera, 0, 120, false);
                    }
                }
            }
        });

        canvas.addEventListener("pointerdown", function (event) {
            event.preventDefault();
            if (drawMode && event.button === 2) {
                drawMode = false;
                if (drawPoints.length > 1) {
                    drawPoints.push(drawPoints[0].clone());
                    var line = BABYLON.Mesh.CreateLines("lines", drawPoints, scene);
                    lines.push(line);
                    extrudeButton.disabled = false;
                    extrudeButton.classList.add("bright");
                }
                // Adjust camera to fit the drawing plane
                if (drawPoints.length > 0) {
                    var bbox = new BABYLON.BoundingBoxGenerator();
                    bbox.update(drawPoints);
                    var boundingBox = bbox.boundingBox;
                    var center = boundingBox.center;
                    var halfExtents = boundingBox.extendSize.scale(0.5);
                    var width = Math.max(halfExtents.x, halfExtents.z) * 2;
                    var height = Math.max(halfExtents.x, halfExtents.z) * 2;
                    var distance = Math.max(width, height) / Math.tan(camera.fov / 2);
                    BABYLON.Animation.CreateAndStartAnimation('cameraFollowMouse', camera, 'position', 60, 120, camera.position, center.add(new BABYLON.Vector3(0, distance, 0)), BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
                }
            }
        });

        drawButton.addEventListener("click", function () {
            
            if (drawMode) {
                // If draw mode is already active, switch to move mode
                drawMode = false;
                enterMoveMode();
            } else {
                enterDrawMode();
            }
            if(extrudeButton){
                drawButton.disabled=true;
            }
        });

        extrudeButton.addEventListener("click", function () {
            
            if (drawPoints.length > 1) {
                drawPoints.push(drawPoints[0].clone());
                var shape = BABYLON.MeshBuilder.CreatePolygon("polygon", { shape: drawPoints }, scene);
                sketchMesh = shape;
                shape.material = new BABYLON.StandardMaterial("shapeMat", scene);
                shape.material.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());

                var extrusionHeight = 2;
                var extrudedShape = BABYLON.MeshBuilder.ExtrudePolygon("extrudedShape", { shape: drawPoints, depth: extrusionHeight }, scene);
                extrudedShape.position.y = extrusionHeight; // Adjust position to stay above the ground
                extrudedShape.material = new BABYLON.StandardMaterial("extrudedShapeMat", scene);
                extrudedShape.material.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());

                drawPoints = [];
                lines.forEach(function(line) {
                    line.dispose();
                });
                lines = [];

                extrudeButton.disabled = true;
                drawButton.disabled=false;
                extrudeButton.classList.remove("bright");
                moveButton.disabled = false; // Enable the Move button after extrusion
                moveButton.classList.add("bright"); // Highlight the Move button
                // Store the extruded shape for future reference
                previousObjects.push(extrudedShape);
            }
        });

        moveButton.addEventListener("click", function () {
            if (!moveMode) {
                enterMoveMode();
            }
            moveButton.disabled=true;
            drawButton.disabled=true;
        });

        exitMoveButton.addEventListener("click", function () {
            if (moveMode) {
                drawButton.disabled=false;
                moveButton.disabled = false;
                exitMoveMode();
            } else {
                drawMode = true;
                extrudeButton.disabled = true;
                moveButton.disabled = true;
                exitMoveButton.disabled = true;
            }
        });

        scene.onPointerDown = function (evt, pickResult) {
            if (moveMode && pickResult.hit) {
                selectedMesh = pickResult.pickedMesh;
            }
        };

        scene.onPointerMove = function (evt) {
            if (moveMode && selectedMesh) {
                var pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit) {
                    selectedMesh.position.x = pickResult.pickedPoint.x;
                    selectedMesh.position.z = pickResult.pickedPoint.z;
                }
            }
        };

        scene.onPointerUp = function (evt) {
            if (moveMode) {
                selectedMesh = null;
            }
        };
    };

    createScene();

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });
});