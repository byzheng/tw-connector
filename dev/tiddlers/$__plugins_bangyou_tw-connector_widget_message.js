/*\

message widget

\*/
(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";
    //const fs = require('fs');
    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    var MessageWidget = function (parseTreeNode, options) {
        this.initialise(parseTreeNode, options);
    };

    /*
    Inherit from the base widget class
    */
    MessageWidget.prototype = new Widget();


    function getTimestampedFilename(base, ext) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // months are 0-based
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
    
        return base  + "/" + `${year}` + "/" + `${year}${month}${day}${hours}${minutes}${seconds}` + "." + ext;
    }

    function getImageExtension(base64String) {
        // Use a regular expression to match the format "data:image/<extension>;base64,"
        const match = base64String.match(/^data:image\/(\w+);base64,/);
        
        // If there's a match, return the captured extension (e.g., "png", "jpeg")
        if (match) {
            return match[1];
        } else {
            throw new Error("Invalid base64 image format");
        }
    }

    /*
    Render this widget into the DOM
    */
    MessageWidget.prototype.render = function (parent, nextSibling) {
        this.parentDomNode = parent;
        this.computeAttributes();

        var containerDom = document.createElement('div');
        containerDom.id = "tw-research-message";
        containerDom.innerText = "message";
        containerDom.hidden = true;

        // Event 

        var openLinkFromInsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromInsideRiver").fields.text;
        var openLinkFromOutsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromOutsideRiver").fields.text
        var the_story = new $tw.Story({ wiki: $tw.wiki });

        containerDom.addEventListener("research-message", function (event) {
            let request = event.detail.request;
            if (request.method === "open_tiddler") {
                var tiddler = request.tiddler;
                if (tiddler === undefined) {
                    return;
                }
                if (!$tw.wiki.tiddlerExists(tiddler)) {
                    return;
                }
                // Open tiddler
                the_story.addToStory(tiddler, "", {
                    openLinkFromInsideRiver: openLinkFromInsideRiver,
                    openLinkFromOutsideRiver: openLinkFromOutsideRiver
                });
                the_story.addToHistory(tiddler);
            } else if (request.method === "new_colleague") {
                var tiddler = request.data.title;
                if (tiddler === undefined) {
                    return;
                }
                if ($tw.wiki.tiddlerExists(tiddler)) {
                    return;
                }
                
                if (request.data.image !== null) {
                    const extension = getImageExtension(request.data.image);
                    const base64Data = request.data.image.replace(/^data:image\/\w+;base64,/, "");
                    const fileName = getTimestampedFilename("/files/images", extension);

                    // URL for the TiddlyWiki route you created
                    const uploadUrl = `${fileName}`;

                    fetch(uploadUrl, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "text/plain",
                            "X-Requested-With": "TiddlyWiki"
                        },
                        body: base64Data  // Send the base64-encoded image data without the prefix
                    })
                    .then(response => {
                        if (response.ok) {
                            console.log(`Successfully uploaded ${fileName}`);
                        } else {
                            console.error("Upload failed:", response.statusText);
                        }
                    })
                    .catch(error => {
                        console.error("Error uploading image:", error);
                    });
                    request.data.image = fileName;
                }
                $tw.wiki.addTiddler(new $tw.Tiddler(request.data));
                the_story.addToStory(tiddler, "", {
                    openLinkFromInsideRiver: openLinkFromInsideRiver,
                    openLinkFromOutsideRiver: openLinkFromOutsideRiver
                });
                the_story.addToHistory(tiddler);
            }
        });

        parent.insertBefore(containerDom, nextSibling);

    };



    exports.message = MessageWidget;

})();