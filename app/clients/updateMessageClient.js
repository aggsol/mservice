/**
 * m!service
 * Copyright(c) 2014-2018 Christopher Reitz.
 * MIT Licensed
 */
'use strict';

module.exports = function(log, httpClient, sharedCache, scrapers) {
    return function(res, username, boardId, threadId, messageId, subject, text, fn) {
        var options = {
            jar: res.jar,
            form: {
                mode: 'messageeditsave',
                brdid: boardId,
                msgid: messageId,
                subject: subject,
                body: text
            }
        };

        httpClient.post(res, options, function (html, response) {
            var error = null;

            var title = scrapers.title(html);
            if (title !== httpClient.errors.maniacBoardTitles.confirm) {
                error = 'unknown';
                if (html.includes('Incorrect string value:')) {
                    error = 'emoji';
                } else if (title === httpClient.errors.maniacBoardTitles.error) {
                    var maniacErrorMessage = scrapers.errorMessage(html);
                    if (httpClient.errors.maniacMessages[maniacErrorMessage] !== undefined) {
                        error = httpClient.errors.maniacMessages[maniacErrorMessage];
                    }
                } else if (title === httpClient.errors.maniacBoardTitles.edit) {
                    var maniacErrorMessage2 = scrapers.errorMessage2(html);
                    if (httpClient.errors.maniacMessages[maniacErrorMessage2] !== undefined) {
                        error = httpClient.errors.maniacMessages[maniacErrorMessage2];
                    }
                }
            }

            if (!error) {
                sharedCache.del('messageList/' + threadId);
                sharedCache.del('threadList/' + boardId);
            }

            fn(null, error);
        });
    };
};
