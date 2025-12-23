/*\
title: $:/plugins/bangyou/tw-connector/widget/reference.js
type: application/javascript
module-type: widget
Reference widget for TiddlyWiki

\*/


'use strict';


(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";
    //const fs = require('fs');
    var Widget = require("$:/core/modules/widgets/widget.js").widget;

    var ReferencesWidget = function (parseTreeNode, options) {
        this.initialise(parseTreeNode, options);
    };

    var literature = require("$:/plugins/bangyou/tw-connector/utils/literature.js").Literature();

    /*
    Inherit from the base widget class
    */
    ReferencesWidget.prototype = new Widget();


    /*
    Render this widget into the DOM
    */
    ReferencesWidget.prototype.render = function (parent, nextSibling) {
        this.parentDomNode = parent;
        this.computeAttributes();

        var containerDom = document.createElement('div');
        parent.insertBefore(containerDom, nextSibling);

        var days = this.getAttribute("days") || 90;
        fetch(`/literatures/latest?days=${days}`)
            .then(response => {
                if (!response.ok) {
                    containerDom.innerHTML = "Error fetching latest literatures: " + response.statusText;
                    return Promise.reject(); // stop further processing
                }
                return response.json(); // parse the response body
            })
            .then(results => {
                var innerHTML = literature.card(results.items);
                containerDom.appendChild(innerHTML);
            })
            .catch(err => {
                if (err) { // only show message if not already handled
                    containerDom.innerHTML = "Exception fetching latest literatures: " + err.message;
                }
            });

    };



    exports["literatureslatest"] = ReferencesWidget;



})();