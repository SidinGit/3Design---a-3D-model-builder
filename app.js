// Wait for the DOM content to be fully loaded before executing the script
document.addEventListener("DOMContentLoaded", function () {
    // Get the canvas element
    var canvas = document.getElementById("renderCanvas");
    // Create a Babylon.js engine
    var engine = new BABYLON.Engine(canvas, true);
    // Initialize variables to store button elements and other scene elements
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
    var drawMode = false; // Flag to indicate if in drawing mode
    var drawPoints = []; // Store points drawn by the user
    var lines = []; // Store lines created from drawn points
    var moveMode = false; // Flag to indicate if in move mode

    // Disable all buttons except Draw button initially
    extrudeButton.disabled = true;
    moveButton.disabled = true;
    exitMoveButton.disabled = true;
    vertexEditButton.disabled = true;
    // Function to create the Babylon.js scene
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

        // Function to enter drawing mode
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

        // Function to enter move mode
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

        // Function to exit move mode
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

        // Event listener for left-click to draw
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

        // Event listener for right-click to end drawing
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

        // Event listener for draw button click
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

        // Event listener for extrude button click
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

        // Event listener for move button click
        moveButton.addEventListener("click", function () {
            if (!moveMode) {
                enterMoveMode();
            }
            moveButton.disabled=true;
            drawButton.disabled=true;
        });

        // Event listener for exit move button click
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

        // Event listener for pointer down event to select mesh in move mode
        scene.onPointerDown = function (evt, pickResult) {
            if (moveMode && pickResult.hit) {
                selectedMesh = pickResult.pickedMesh;
            }
        };

        // Event listener for pointer move event to move selected mesh in move mode
        scene.onPointerMove = function (evt) {
            if (moveMode && selectedMesh) {
                var pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit) {
                    selectedMesh.position.x = pickResult.pickedPoint.x;
                    selectedMesh.position.z = pickResult.pickedPoint.z;
                }
            }
        };

        // Event listener for pointer up event to release selected mesh in move mode
        scene.onPointerUp = function (evt) {
            if (moveMode) {
                selectedMesh = null;
            }
        };
    };

    // Create the scene
    createScene();

    // Run the render loop
    engine.runRenderLoop(function () {
        scene.render();
    });

    // Resize the engine when the window is resized
    window.addEventListener("resize", function () {
        engine.resize();
    });
});
