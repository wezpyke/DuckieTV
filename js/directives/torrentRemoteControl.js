DuckieTV
/**
 * Torrent Remote Control Directive
 */
.directive('torrentRemoteControl', ["DuckieTorrent", "$rootScope",
    function(DuckieTorrent, $rootScope) {
        return {
            restrict: 'E',
            transclude: true,
            replace: false,
            scope: {
                infoHash: '=infoHash',
                templateUrl: '=templateUrl',
                episodeDownloaded: '=downloaded'
            },
            templateUrl: function($node, $iAttrs) {
                return $iAttrs.templateUrl;
            },
            controllerAs: 'remote',
            controller: ["$scope", "$rootScope",
                function($scope, $rootScope) {

                    var remote = this;
                    remote.infoHash = $scope.infoHash;
                    remote.torrent = null;
                    remote.isConnected = false;

                    this.getFiles = function(torrent) {
                        remote.torrent.getFiles().then(function(files) {
                            remote.torrent_files = files.map(function(file) {
                                file.isMovie = file.name.substring(file.name.length - 3).match(/mp4|avi|mkv|mpeg|mpg|flv/g);
                                if (file.isMovie) {
                                    file.searchFileName = file.name.split('/').pop().split(' ').pop();
                                }
                                return file;
                            });
                        });
                    };

                    /**
                     * Observes the torrent and watches for changes (progress)
                     */
                    function observeTorrent(rpc, infoHash) {
                        DuckieTorrent.getClient().getRemote().onTorrentUpdate(infoHash, function(newData) {
                            remote.torrent = newData;
                            $scope.$applyAsync();
                        });
                    }

                    // If the connected info hash changes, remove the old event and start observing the new one.
                    $scope.$watch('infoHash', function(newVal, oldVal) {
                        if (newVal == oldVal) return;
                        remote.infoHash = newVal;
                        DuckieTorrent.getClient().AutoConnect().then(function(rpc) {
                            remote.torrent = DuckieTorrent.getClient().getRemote().getByHash(remote.infoHash);
                            DuckieTorrent.getClient().getRemote().offTorrentUpdate(oldVal, observeTorrent);
                            observeTorrent(rpc, remote.infoHash);
                        });
                    });

                    /**
                     * Auto connect and wait for initialisation, then start monitoring updates for the torrent hash in the infoHash
                     */
                    DuckieTorrent.getClient().AutoConnect().then(function(rpc) {
                        remote.isConnected = true;
                        remote.torrent = DuckieTorrent.getClient().getRemote().getByHash(remote.infoHash);
                        observeTorrent(rpc, remote.infoHash);
                        remote.cleanupHashCheck();
                    }, function(fail) {
                        // Failed to connect to torrent client for monitoring. Creating an event watcher for when torrent client is connected.
                        $rootScope.$on('torrentclient:connected', function(rpc) {
                            remote.isConnected = true;
                            remote.torrent = DuckieTorrent.getClient().getRemote().getByHash(remote.infoHash);
                            observeTorrent(rpc, remote.infoHash);
                            remote.cleanupHashCheck();
                        });
                    });

                    this.cleanupHashCheck = function() {
                        // clean up when episode has been downloaded and torrent has not been found in torrent-client
                        if ($scope.episodeDownloaded) {
                            DuckieTorrent.getClient().hasTorrent(remote.infoHash).then(function(hasTorrent) {
                                if (!hasTorrent) {
                                    Episode.findOneByMagnetHash(remote.infoHash).then(function(result) {
                                        if (result) {
                                            console.info('remote torrent not found, removed magnetHash[%s] from episode[%s] of series[%s]', result.magnetHash, result.getFormattedEpisode(), result.ID_Serie);
                                            result.magnetHash = null;
                                            result.Persist();
                                        }
                                    })
                                }
                            })
                        }
                    };

                }
            ]
        };

    }
]);