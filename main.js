(function () {
    var video = document.querySelector('video');
    
    var pictureWidth = 0;
    var pictureHeight = 0;

    var fxCanvas = null;
    var texture = null;
	var intervalStart;
	var count;
	var countPlus = 0;
    function checkRequirements() {
        var deferred = new $.Deferred();

        //Check if getUserMedia is available
        if (!Modernizr.getusermedia) {
            deferred.reject('Your browser doesn\'t support getUserMedia (according to Modernizr).');
        }

        //Check if WebGL is available
        if (Modernizr.webgl) {
            try {
                //setup glfx.js
                fxCanvas = fx.canvas();
            } catch (e) {
                deferred.reject('Sorry, glfx.js failed to initialize. WebGL issues?');
            }
        } else {
            deferred.reject('Your browser doesn\'t support WebGL (according to Modernizr).');
        }

        deferred.resolve();

        return deferred.promise();
    }

    function searchForRearCamera() {
        var deferred = new $.Deferred();

        //MediaStreamTrack.getSources seams to be supported only by Chrome
        if (MediaStreamTrack && MediaStreamTrack.getSources) {
            MediaStreamTrack.getSources(function (sources) {
                var rearCameraIds = sources.filter(function (source) {
                    return (source.kind === 'video' && source.facing === 'environment');
                }).map(function (source) {
                    return source.id;
                });

                if (rearCameraIds.length) {
                    deferred.resolve(rearCameraIds[0]);
                } else {
                    deferred.resolve(null);
                }
            });
        } else {
            deferred.resolve(null);
        }

        return deferred.promise();
    }

    function setupVideo(rearCameraId) {
        var deferred = new $.Deferred();
        var getUserMedia = Modernizr.prefixed('getUserMedia', navigator);
        var videoSettings = {
            video: {
                optional: [
                    {
                        width: {min: pictureWidth}
                    },
                    {
                        height: {min: pictureHeight}
                    }
                ]
            }
        };

        //if rear camera is available - use it
        if (rearCameraId) {
            videoSettings.video.optional.push({
                sourceId: rearCameraId
            });
        }

        getUserMedia(videoSettings, function (stream) {
            //Setup the video stream
            video.src = window.URL.createObjectURL(stream);

            window.stream = stream;

            video.addEventListener("loadedmetadata", function (e) {
                //get video width and height as it might be different than we requested
                pictureWidth = this.videoWidth;
                pictureHeight = this.videoHeight;

                if (!pictureWidth && !pictureHeight) {
                    //firefox fails to deliver info about video size on time (issue #926753), we have to wait
                    var waitingForSize = setInterval(function () {
                        if (video.videoWidth && video.videoHeight) {
                            pictureWidth = video.videoWidth;
                            pictureHeight = video.videoHeight;

                            clearInterval(waitingForSize);
                            deferred.resolve();
                        }
                    }, 100);
                } else {
                    deferred.resolve();
                }
            }, false);
        }, function () {
            deferred.reject('There is no access to your camera, have you denied it?');
        });

        return deferred.promise();
    }

	checkRequirements().then(searchForRearCamera).then(setupVideo)

    function step1() {
        checkRequirements()
            .done(function () {
                $('#takePicture').removeAttr('disabled');
                $('#step1 figure').removeClass('not-ready');
				intervalStart = 1;
            })
            .fail(function (error) {
                showError(error);
            });
    }

    function step2() {
        var canvas = document.querySelector('#step2 canvas');
        var img = document.querySelector('#step2 img');

        //setup canvas
        canvas.width = pictureWidth;
        canvas.height = pictureHeight;

        var ctx = canvas.getContext('2d');

        //draw picture from video on canvas
        ctx.drawImage(video, 0, 0);

        //modify the picture using glfx.js filters
        texture = fxCanvas.texture(canvas);
        fxCanvas.draw(texture)
            .hueSaturation(-1, -1)//grayscale
            .unsharpMask(20, 2)
            .brightnessContrast(0.2, 0.9) //화면 색상 반전
            .update();

        window.texture = texture;
        window.fxCanvas = fxCanvas;
        $(img).attr('src', fxCanvas.toDataURL());

    }

    function step3() {
		var canvas = document.querySelector('#step3 canvas');
        var step2Image = document.querySelector('#step2 img');

        var scale = step2Image.width / $(step2Image).width();
        //draw cropped image on the canvas
        canvas.width = 640;
        canvas.height = 500;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(step2Image, 0, 0);
        //use ocrad.js to extract text from the canvas
        var resultText = OCRAD(ctx); // 문서식별
        resultText = resultText.trim();
        //show the result
			var testLavel = "<img style='width:100px; height:100px;' src='"+canvas.toDataURL()+"' />"+"<li><p>TEST WORD : " + resultText + " OK?</p></li>";
		$('#testimg').append(testLavel);
		count = $("#countStay").val();
		$("#testimg li").each(function(idx){
			if(idx === Number(count)){
				$('#testimg').html("");
			}
		});
        console.log("Text Length : "+resultText.length);
    }

    /*********************************
     * UI Stuff
     *********************************/

	step1();
	if(intervalStart === 1){
		setInterval(function(){ // 인터발~!
			step2();
			step3();
			},2000);
	}

})();