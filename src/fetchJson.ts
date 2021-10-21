import * as vscode from 'vscode';
const config = require('../config.json');
const fetch = require('make-fetch-happen').defaults({
    // path where cache will be written (and read)
    cachePath: `${config.cacheDir}`, 
});

// Function to make DockerHubAPI calls and return JSON data.
export async function fetchJson(urlDockerHubAPICall:string){
    const fetchedJson = await fetch(urlDockerHubAPICall)
    .then(async (res:any) => {
        if(!res.ok) {
            res.text().then((text: string | undefined) => {throw Error(text);});
        }
        else{
            const data = await res.json();
            if(data){
                return data;
            }
        }    
    })
    .catch((err:any) => {
        const error = String(err);
        const errorMsgSplit = error.split('\n');
        // Extract the first line from the Error stack trace.
        const errorMsg = errorMsgSplit[0].slice(errorMsgSplit[0].search(/reason/gi));
        if(errorMsg.search(/getaddrinfo ENOTFOUND/gi )!== -1){
            vscode.window.showErrorMessage(`FetchError (${errorMsg}). Restarting Visual Studio Code may resolve this issue. `);
        }
        else{
            vscode.window.showErrorMessage(errorMsgSplit[0]);
        }
    });
    return fetchedJson;
}