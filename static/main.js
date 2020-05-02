import {getHashParams} from './assets/getAccess.js';

window.onSpotifyWebPlaybackSDKReady = () => {
    $(function () {
        // const socket = io.connect('http://localhost:3000/#');
        const socket = io.connect('https://chat-spotify.herokuapp.com/#');
        const ACCESS_TOKEN = getHashParams().access_token;
        let playlist = '';

        const token = ACCESS_TOKEN;
        const player = new Spotify.Player({
            name: 'Web Playback',
            getOAuthToken: callback => {
                callback(token);
            },
            volume: 0.1
        });

        function playURI(uri){

            // Called when connected to the player created beforehand successfully
            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);

                const play = ({
                                  spotify_uri,
                                  playerInstance: {
                                      _options: {
                                          getOAuthToken,
                                          id
                                      }
                                  }
                              }) => {
                    getOAuthToken(access_token => {
                        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ uris: [spotify_uri] }),
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${access_token}`
                            },
                        });
                    });
                };

                play({
                    playerInstance: player,
                    spotify_uri: uri,
                });
            });
            player.connect();
        }

        const searchSong = () => {
            const button = document.getElementById('search-button');
            button.addEventListener("click", () => {
                const value = document.getElementById('search-value').value;
                if (value !== '') {
                    fetchSong(value);
                }
            });
        };

        searchSong();

        function fetchSong(search) {
            fetch(`https://api.spotify.com/v1/search?q=${search}&type=track,album`, {
                headers: {
                    'Authorization': 'Bearer ' + ACCESS_TOKEN
                }
            }).then(response => {
                return response.json();
            }).then(json => {
                const values = filterFetch(json.tracks.items);
                createDiv('results', values);
                clickSong(values);
            });
        }

        function filterFetch(fetched) {
            const cleanData = fetched.map(item => {
                return {
                    id: item.id,
                    name: item.name,
                    artist: item.artists[0].name,
                    image: item.album.images[2].url
                }
            });
            return cleanData;
        }

        function clear(section) {
            document.getElementById(section).innerHTML = "";
        }

        //put search results in result box
        function createDiv(section, objects) {
            if (section === 'results') {
                clear(section);
            }
            let value = '';
            objects.forEach(item => {
                value += `<div id="${item.id}"><img src="${item.image}"><p>${item.artist} - ${item.name}</p></div>`;
            });
            $(`#${section}`).html(value);
        }

        function getUser() {
            return fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': 'Bearer ' + ACCESS_TOKEN
                }
            }).then(response => {
                return response.json();
            }).then(result => {
                return result;
            });
        }

        function getPlaylist(playlist) {
            return fetch(`https://api.spotify.com/v1/playlists/${playlist}`, {
                headers: {
                    'Authorization': 'Bearer ' + ACCESS_TOKEN
                }
            }).then(response => {
                return response.json();
            }).then(result => {
                return result;
            }).catch(e => {
                console.error(e);
            });
        }

        socket.on('news', (data) => {
            console.log(data.hello);
            socket.emit('other event', {my: 'data'});
        });

        socket.emit('connected');

        /**
         * gives latest connected person all current songs
         */
        socket.on('playlistID', (data) => {
            playlist = data.playlistID;
            getPlaylist(playlist).then(result => { /*playSong(`${result.uri}`)*/
            })
        });

        /**
         *
         * @param songs
         */
        function clickSong(songs) {
            for (let song of songs) {
                $(`#${song.id}`).click(() => {
                    socket.emit('click song', {
                        access: ACCESS_TOKEN,
                        songID: song.id
                    })
                });
            }
        }

        socket.on('add song', (data) => {
            let songData = [data.song];
            let result = filterFetch(songData);
            createDiv('songs', result);
            playURI(songData[0].uri);
        });

    });
};
