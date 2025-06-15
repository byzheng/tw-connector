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


        var openLinkFromOutsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromOutsideRiver").fields.text;
        var openLinkFromInsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromInsideRiver").fields.text;
        
        var the_story = new $tw.Story({ wiki: $tw.wiki });
        // Make the_story accessible to helper functions
        this.the_story = the_story;
        this.openLinkFromInsideRiver = openLinkFromInsideRiver;
        this.openLinkFromInsideRiver = openLinkFromInsideRiver;
        var _this = this;

        containerDom.addEventListener("research-message", function (event) {

            window.focus();
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
            } else if (request.method === "new_bibtex_entry") {
                _this.addBibtexEntry(request);
            } else if (request.method === "new_colleague") {
                var tiddler = request.data.title;
                if (tiddler === undefined) {
                    return;
                }
                if ($tw.wiki.tiddlerExists(tiddler)) {
                    return;
                }

                if (request.data.image !== null) {
                    request.data.image = uploadImage(request.data.image);
                }
                $tw.wiki.addTiddler(new $tw.Tiddler(request.data));
                the_story.addToStory(tiddler, "", {
                    openLinkFromInsideRiver: openLinkFromInsideRiver,
                    openLinkFromOutsideRiver: openLinkFromOutsideRiver
                });
                the_story.addToHistory(tiddler);
            } else if (request.method === "new_image") {
                var image = request.image;
                if (image === undefined) {
                    return;
                }
                if (image === null) {
                    return;
                }
                var filename = uploadImage(request.image);
                var tiddler = filename.split('/').pop();
                const contentType = request.image.match(/^data:(.*?);base64,/);
                // Create canonical images
                var isSaveCanonical = $tw.wiki.getTiddlerText("$:/config/tw-connector/SaveCanonicalTiddler") || "disable";
                if (isSaveCanonical === "enable") {
                    $tw.wiki.addTiddler(new $tw.Tiddler({
                        title: tiddler,
                        url: request.url,
                        _canonical_uri: filename,
                        type: contentType[1]
                    }));

                    the_story.addToStory(tiddler, "", {
                        openLinkFromInsideRiver: openLinkFromInsideRiver,
                        openLinkFromOutsideRiver: openLinkFromOutsideRiver
                    });
                }
                // copy image macro
                var copyImgMacro = $tw.wiki.getTiddlerText("$:/config/tw-connector/CopyImageMacro") || " [img[$filename$]] ";
                if (copyImgMacro !== "") {
                    const img_macro = copyImgMacro.replace("$filename$", filename);
                    copyToClipboard(img_macro);
                    var InsertIntoTextArea = $tw.wiki.getTiddlerText("$:/config/tw-connector/InsertIntoTextArea") || "disable";
                    if (InsertIntoTextArea === "enable") {
                        insertTextAtCursor(document, img_macro);
                    }
                }
            }
        });

        parent.insertBefore(containerDom, nextSibling);

    };

    
    MessageWidget.prototype.addBibtexEntry = function(request) {
        const bibtex = request.bibtex;
        const title = request.title;
        if (bibtex === undefined) {
            return;
        }
        if (title === undefined || Array.isArray(title)) {
            return;
        }
        
        

        // Check if the tiddler already exists
        if (!$tw.wiki.tiddlerExists("$:/plugins/tiddlywiki/bibtex")) {
            return;
        }
        // Check if the tiddler already exists
        if ($tw.wiki.tiddlerExists(title)) {
            return;
        }

        let new_tiddler = $tw.wiki.deserializeTiddlers(null,
            bibtex,
            {title: title},
            {deserializer: "application/x-bibtex"}
        );

        if (!Array.isArray(new_tiddler) || new_tiddler.length === 0) {
            return;
        }
        new_tiddler = new_tiddler[0];
        new_tiddler["tags"] = ["bibtex-entry"];
        new_tiddler["created"] = $tw.utils.formatDateString(new Date(), "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
        new_tiddler["modified"] = new_tiddler["created"];
        new_tiddler["bibtex-zotero-pdf-key"] = request.pdf_key;

        $tw.wiki.addTiddler(new $tw.Tiddler(new_tiddler));		
        this.the_story.addToStory(title, "", {
            openLinkFromInsideRiver: this.openLinkFromInsideRiver,
            openLinkFromOutsideRiver: this.openLinkFromOutsideRiver
        });
        this.the_story.addToHistory(title);
        return;
    };

    exports.message = MessageWidget;


    var FilenameWidget = function (parseTreeNode, options) {
        this.initialise(parseTreeNode, options);
    };
    FilenameWidget.prototype = new Widget();


    FilenameWidget.prototype.render = function (parent, nextSibling) {
        this.parentDomNode = parent;

        var containerDom = document.createElement('span');
        containerDom.innerText = getTimestampedFilename("png");
        parent.innerHTML = '';
        parent.insertBefore(containerDom, nextSibling);

    }

    FilenameWidget.prototype.refresh = function (changedTiddlers) {
        //this.refreshSelf();
        return false;
    };

    exports.imagefilepath = FilenameWidget;


    function getTimestampedFilename(ext) {
        var format = $tw.wiki.getTiddlerText("$:/config/tw-connector/ImageFileFormat") || "images/YYYY/YYYY0MM0DD0hh0mm0ss";
        const now = new Date();
        var path = $tw.utils.formatDateString(now, format)
        return "/files/" + path + "." + ext;
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


    function uploadImage(image) {
        const extension = getImageExtension(image);
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const fileName = getTimestampedFilename(extension);

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
        return (fileName);
    }
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            console.log("Text copied to clipboard:", text);
        } catch (err) {
            console.error("Failed to copy text:", err);
        }
    }

    function insertTextAtCursor(document, text) {
        // Get the active element (should be a text field or textarea)
        const activeElement = document.activeElement;
        // Check if the active element is editable
        if (activeElement && (
            activeElement.tagName.toLowerCase() === 'textarea' ||
            activeElement.tagName.toLowerCase() === 'input')) {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;

            // Get the current value of the input/textarea
            const currentValue = activeElement.value;

            // Insert the text at the cursor position
            activeElement.value = currentValue.slice(0, start) + text + currentValue.slice(end);

            // Update the cursor position
            activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        }
    }

})();