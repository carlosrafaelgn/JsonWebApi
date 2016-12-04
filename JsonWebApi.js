"use strict";
/*!
 JsonWebApi v1.0.0 is distributed under the FreeBSD License

 Copyright (c) 2016, Carlos Rafael Gimenes das Neves
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 https://github.com/carlosrafaelgn/JsonWebApi
*/
(function () {
	var buildException = function (xhr, ex) {
		return (ex.message ?
					{ xhr: xhr, success: false, status: -1, value: JsonWebApi.messages.exceptionDescription + ex.message, exceptionType: (ex.name || "Error") } :
					{ xhr: xhr, success: false, status: -1, value: JsonWebApi.messages.exceptionDescription + ex, exceptionType: (ex.name || "Error") });
	},
	buildResponse = function (xhr) {
		try {
			if (xhr.status === 200) {
				return { xhr: xhr, success: true, status: 200, value: JSON.parse(xhr.responseText) };
			} else if (xhr.status > 200 && xhr.status < 300) {
				return { xhr: xhr, success: true, status: xhr.status, value: "" };
			} else {
				// Errors are handled here
				var err = JSON.parse(xhr.responseText);
				if (err && err.ExceptionMessage)
					return { xhr: xhr, success: false, status: xhr.status, value: err.ExceptionMessage, exceptionType: (err.ExceptionType || "System.Exception") };
				else if (err && err.Message)
					return { xhr: xhr, success: false, status: xhr.status, value: err.Message, exceptionType: (err.ExceptionType || "System.Exception") };
				else
					return { xhr: xhr, success: false, status: xhr.status, value: JsonWebApi.messages.networkError + xhr.status, exceptionType: "System.Exception" };
			}
		} catch (ex) {
			if (ex.name === "SyntaxError")
				return { xhr: xhr, success: false, status: -1, value: xhr.responseText, exceptionType: "SyntaxError" };
			return buildException(xhr, ex);
		}
	},
	buildFullUrl = function (url, args, start) {
		var name, value, i, j, fullUrl = url + "?";
		for (i = start; i < args.length; i += 2) {
			name = args[i];
			value = args[i + 1];

			if (!name && name !== 0)
				throw JsonWebApi.messages.invalidParameterName;
			name = encodeURIComponent(name) + "=";

			// Completely skip the parameter
			if (value === undefined || value === null)
				continue;

			if (value.constructor === Array) {
				if (!value.length) {
					// Completely skip the parameter, because if "name=" is sent, ASP.NET
					// will deserialize it as an array with 1 element containing default(type)
					continue;
				} else {
					if (i !== start)
						fullUrl += "&";

					fullUrl += name + encodeURIComponent((value[0] === undefined || value[0] === null) ? "" : value[0]);
					for (j = 1; j < value.length; j++)
						fullUrl += "&" + name + encodeURIComponent((value[j] === undefined || value[j] === null) ? "" : value[j]);
					continue;
				}
			} else {
				switch ((typeof value)) {
					case "function":
						throw JsonWebApi.messages.parameterValueCannotBeFunction;
					case "object":
						throw JsonWebApi.messages.parameterValueCannotBeObject;
				}
			}

			if (i !== start)
				fullUrl += "&";

			fullUrl += name + encodeURIComponent(value);
		}
		return fullUrl;
	},
	sendRequest = function (async, method, url, callback, bodyObject) {
		var done = false, xhr;

		JsonWebApi.active++;

		try {
			xhr = new XMLHttpRequest();

			xhr.open(method, url, async);

			if (JsonWebApi.avoidCache) {
				xhr.setRequestHeader("Cache-Control", "no-cache, no-store");
				xhr.setRequestHeader("Pragma", "no-cache");
			}

			xhr.setRequestHeader("Accept", "application/json");

			if (async) {
				xhr.onreadystatechange = function () {
					if (xhr.readyState === 4 && !done) {
						done = true;
						JsonWebApi.active--;
						callback(buildResponse(xhr));
					}
				}
			}

			if (bodyObject != undefined) {
				xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
				xhr.send(JSON.stringify(bodyObject));
			} else {
				xhr.send();
			}

			if (async)
				return true;

			return buildResponse(xhr);
		} catch (ex) {
			if (!async)
				return buildException(xhr, ex);

			done = true;
			JsonWebApi.active--;
			callback(buildException(xhr, ex));
			return false;
		} finally {
			if (!async)
				JsonWebApi.active--;
		}
	};
	window.JsonWebApi = {
		messages: {
			invalidURL: "URL inválido",
			invalidCallback: "Callback inválido",
			invalidBodyObject: "Objeto do corpo da requisição inválido",
			invalidArguments: "Argumentos inválidos",
			invalidArgumentCount: "Quantidade de argumentos inválidos",
			invalidParameterName: "Nome do parâmetro inválido",
			parameterValueCannotBeObject: "O valor de um parâmetro não podem ser um objeto",
			parameterValueCannotBeFunction: "O valor de um parâmetro não podem ser uma função",
			exceptionDescription: "Ocorreu o seguinte erro: ",
			networkError: "Ocorreu um erro de rede: "
		},
		active: 0,
		avoidCache: true,
		redirect: function (url, name0, value0) {
			if (!url)
				throw JsonWebApi.messages.invalidURL;

			if (!(arguments.length & 1))
				throw JsonWebApi.messages.invalidArgumentCount;

			window.location.href = ((arguments.length > 1) ? buildFullUrl(url, arguments, 1) : url);

			return true;
		},
		getSync: function (url, name0, value0) {
			if (!url)
				throw JsonWebApi.messages.invalidURL;

			if (!(arguments.length & 1))
				throw JsonWebApi.messages.invalidArgumentCount;

			return sendRequest(false, "get", (arguments.length > 1) ? buildFullUrl(url, arguments, 1) : url, null);
		},
		get: function (url, callback, name0, value0) {
			if (!url)
				throw JsonWebApi.messages.invalidURL;

			if (!callback)
				throw JsonWebApi.messages.invalidCallback;

			if ((arguments.length & 1))
				throw JsonWebApi.messages.invalidArgumentCount;

			return sendRequest(true, "get", (arguments.length > 2) ? buildFullUrl(url, arguments, 2) : url, callback);
		},
		postSync: function (url, bodyObject, name0, value0) {
			if (!url)
				throw JsonWebApi.messages.invalidURL;

			if (bodyObject === undefined)
				throw JsonWebApi.messages.invalidBodyObject

			if ((arguments.length & 1))
				throw JsonWebApi.messages.invalidArgumentCount;

			return sendRequest(false, "post", (arguments.length > 2) ? buildFullUrl(url, arguments, 2) : url, null, bodyObject);
		},
		post: function (url, bodyObject, callback, name0, value0) {
			if (!url)
				throw JsonWebApi.messages.invalidURL;

			if (bodyObject === undefined)
				throw JsonWebApi.messages.invalidBodyObject;

			if (!callback)
				throw JsonWebApi.messages.invalidCallback;

			if (!(arguments.length & 1))
				throw JsonWebApi.messages.invalidArgumentCount;

			return sendRequest(true, "post", (arguments.length > 3) ? buildFullUrl(url, arguments, 3) : url, callback, bodyObject);
		}
	};
})();
