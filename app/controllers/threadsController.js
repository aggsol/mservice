/**
 * m!service
 * Copyright(c) 2014-2018 Christopher Reitz.
 * MIT Licensed
 */
'use strict';

var utils = require('./../utils.js');
var injectReadlist = require('./../injectors/readlistInjector.js');
var injectFavorites = require('./../injectors/favoritesInjector.js');
var removeThreadsFromKillfile = require('./../injectors/threadsKillfileInjector.js');

module.exports = function(log, client, db, responses) {
    return {
        /**
         * Index action
         */
        index: function(req, res, next) {
            client.threadList(req, res, req.params.boardId, function(threadList, error) {
                if (req.authorization.basic === undefined) {
                    responses.json(res, threadList, error, next);
                    return;
                }

                removeThreadsFromKillfile(log, db, req, threadList, function(threadList) {
                    injectReadlist(log, db, req, threadList, function(threadList) {
                        injectFavorites(log, db, req, threadList, function(threadList) {
                            responses.json(res, threadList, error, next);
                        });
                    });
                });
            });
        },
        /**
         * Mark as read action
         */
        markAsRead: function(req, res, next) {
            var threadId = req.params.threadId;
            client.messageList(req, res, db, client.threadList, req.params.boardId, threadId, function(messages, error) {
                responses.json(res, 'Ok', null, next);

                req.on('end', function() {
                    var username = req.authorization.basic.username;

                    var messageIds = [];
                    messages.forEach(function(message, key) {
                        messageIds.push(message.messageId.toString());
                    });

                    var readlist = db.get().collection('readlist');
                    var query = { username: username, threadId: threadId };

                    readlist.find(query).toArray(function(err, result) {
                        if (err) {
                            log.error(err);
                        } else if (result.length === 0) {
                            var newEntry = { username: username, threadId: threadId, messages: messageIds };
                            readlist.insertOne(newEntry, function(err, result) {
                                if (err) {
                                    log.error(err);
                                } else {
                                    log.info('User %s marked complete Thread with ID %d as read', username, threadId);
                                }
                            });
                        } else {
                            readlist.updateOne(query, { $set: { messages: messageIds } }, function(err, numUpdated) {
                                if (err) {
                                    log.error(err);
                                } else if (numUpdated) {
                                    log.info('User %s marked complete Thread with ID %d as read', username, threadId);
                                } else {
                                    log.warn('No document found with query:', query);
                                }
                            });
                        }
                    });
                });
            });
        },
        /**
         * Get threadId for message
         */
        threadForMessage: function(req, res, next) {
            client.message(res, false, req.params.boardId, req.params.messageId, function (message, error) {

                if (error) {
                    log.error(error);
                    responses.json(res, null, error, next);
                    return;
                } else if (!message) {
                    responses.json(res, null, error, next);
                    return;
                }

                var messagelist = db.get().collection('messagelist');
                var query = {
                    threadId: utils.toInt(message.threadId),
                };
                messagelist.find(query).toArray(function(err, result) {
                    if (err) {
                        log.error(err);
                    } else if (result.length === 0) {
                        responses.json(res, {}, null, next);
                    } else {
                        var data = result[0].thread || {};
                        data.threadId = message.threadId;

                        responses.json(res, data, error, next);
                    }
                });

            });
        },
        /**
         * Create action
         */
        create: function(req, res, next) {
            if (req.params.subject === undefined || req.params.text === undefined) {
                responses.json(res, null, 'httpBadRequest');
                return;
            }

            client.createMessage(
                res,
                req.params.boardId,
                null,
                null,
                req.authorization.basic.username,
                req.authorization.basic.password,
                req.params.subject,
                req.params.text,
                req.params.notification,
                function(data, error) {
                    responses.json(res, data, error, next);
                }
            );
        },
        /**
         * Search action
         */
        search: function(req, res, next) {
            var phrase = req.params.phrase;
            if (phrase === undefined) {
                responses.json(res, null, 'httpBadRequest');
                return;
            }

            client.searchThreads(res, req.params.boardId, phrase, function(threadList, error) {
                if (req.authorization.basic === undefined) {
                    responses.json(res, threadList, error, next);
                    return;
                }

                injectReadlist(log, db, req, threadList, function(threadList) {
                    responses.json(res, threadList, error, next);
                });
            });
        }
    };
};