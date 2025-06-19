/*\
title: $:/plugins/bangyou/tw-connector/route/authors/scholar/update.js
type: application/javascript
module-type: route

POST /authors/scholar/update
Receives works for a scholar ID from external agent.
\*/

exports.method = "POST";
exports.path = /^\/authors\/scholar\/update$/;

const scholar = require("$:/plugins/bangyou/tw-connector/api/scholar.js").Scholar();
exports.handler = async function(request, response, state) {
    let body = "";
    request.on("data", chunk => body += chunk);
    request.on("end", () => {
        try {
            const data = JSON.parse(state.data);
            const id = data.id;
            const works = data.works;

            if (!id || !Array.isArray(works)) {
                response.writeHead(400, {"Content-Type": "application/json"});
                response.end(JSON.stringify({ 
                    status: "error", 
                    code: 400,
                    message: "Invalid data format" }));
            }

            scholar.cacheWorks(id, works);
            response.writeHead(200, {"Content-Type": "application/json"});
            response.end(JSON.stringify({
                status: "success", 
                code: 200,
                message: "Data saved" }));
        } catch (err) {
            response.writeHead(500, {"Content-Type": "application/json"});
            response.end(JSON.stringify({ 
                status: "error", 
                code: 500,
                codemessage: err.message 
            }));
        }
    });
};
