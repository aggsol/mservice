/**
 * m!service
 * Copyright(c) 2014-2018 Christopher Reitz.
 * MIT Licensed
 */
'use strict';

module.exports = function(log, httpClient, cache, scrapers) {
    return function(res, username, boardId, messageId, fn) {
        var url = httpClient.baseUrl + '?mode=message&brdid=' + boardId + '&msgid=' + messageId;
        var options = url;
        if (res.jar) {
            options = {
                uri: url,
                jar: res.jar
            };
        }
        httpClient.get(res, options, function (html) {
            var data = null;
            var error = null;

            if (scrapers.title(html) === httpClient.errors.maniacBoardTitles.error) {
                error = 'unknown';
                var maniacErrorMessage = scrapers.errorMessage(html);
                if (httpClient.errors.maniacMessages[maniacErrorMessage] !== undefined) {
                    error = httpClient.errors.maniacMessages[maniacErrorMessage];
                }
            } else {
                data = scrapers.message(scrapers, messageId, html);
            }

            fn(data, error);
        });
    };
};
