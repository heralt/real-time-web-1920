import {getHashParams} from './assets/getAccess.js';

let songActive = {
    stateSong: false,
    aListener: function(val) {},
    set state(val) {
        this.stateSong = val;
        this.aListener(val);
    },
    get state() {
        return this.stateSong;
    },
    registerListener: function(listener) {
        this.aListener = listener;
    }
};

window.onSpotifyWebPlaybackSDKReady = () => {
    $(function () {
        // const socket = io.connect('http://localhost:3000/#');
        const socket = io.connect('https://chat-spotify.herokuapp.com/#');
        const ACCESS_TOKEN = getHashParams().access_token;
        let playlist = '';

        const player = new Spotify.Player({
            name: 'Web Playback',
            getOAuthToken: callback => {
                callback(ACCESS_TOKEN);
            },
            volume: 0.5
        });

        function playURI(uri){
            console.log('play ',uri);
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

            player.on('playback_error', ({ message }) => {
                console.error('Failed to perform playback', message);
            });

            player.connect().then(()=>{
                songActive.state = true;
            });
        }

        function queSong(uri){
            console.log('que ', uri);
            fetch(`https://api.spotify.com/v1/me/player/queue?uri=${uri}`,{
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
            }).then(response => {
                return response.json();
            }).then(result => {
                console.log('queued song ', result);
            }).catch(e => {
                console.error('error ',e);
            })
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


        let image = '';

        function songImage(image){
            console.log(image);
            $("#songs").append(`<img src="${image}">`);
        }

        /**
         * checks if songs are finished
         */
        function checkState(){
            player.addListener('player_state_changed', state => {
                if(image !== state.track_window.current_track.album.images[2].url){
                    songImage("");
                    image = state.track_window.current_track.album.images[2].url;
                    songImage(state.track_window.current_track.album.images[2].url);
                }
                console.log(state);
                if(state.paused && state.position === 0 && state.restrictions.disallow_resuming_reasons[0] === "not_paused"
                    && state.track_window.next_tracks.length === 0){
                    console.log('false');
                    songActive.state = false;
                }
            });
        }

        /**
         * check state of current song, if active
         */
        songActive.registerListener(function(val) {
            console.log("state " + val);
            if(val === true){
                setInterval(checkState,3000);
            }else{
                socket.broadcast.emit('no song active',{
                    state: false
                });
                player.disconnect().then();
            }
        });

        socket.emit('connected');

        socket.on('news', (data) => {
            console.log(data.hello);
            socket.emit('other event', {my: 'data'});
        });

        /**
         *
         * @param songs
         */
        function clickSong(songs) {
            for (let song of songs) {
                $(`#${song.id}`).click(() => {
                    if(songActive.state === false){
                        socket.emit('click song', {
                            access: ACCESS_TOKEN,
                            songID: song.id,
                        });
                    } else {
                        socket.emit('click song que', {
                            access: ACCESS_TOKEN,
                            songID: song.id,
                        });
                    }
                });
            }
        }

        socket.on('add song', (data) => {
            if(data.song.error && data.song.error.message === "The access token expired"){
                alert('Je access token is verlopen, log opnieuw in.');
            }
            let songData = [data.song];
            //let result = filterFetch(songData);
            image = songData[0].album.images[0].url;
            songImage(songData[0].album.images[0].url);
            playURI(songData[0].uri);
        });

        socket.on('que song', (data) => {
            let songData = [data.song];
            let result = filterFetch(songData);
            queSong(songData[0].uri);
        });

        socket.on('change state',(data) => {
            songActive.state = data.state;
        });

        let message = $('#message');
        let username = $('#username');
        let send_message = $('#send_message');
        let send_username = $('#send_username');
        let chatroom = $('#messages');

        send_message.click(function(){
            socket.emit('new_message',{
                message: message.val(),
            })
        });

        socket.on('new_message', (data) => {
            console.log('ontvangen: ', data);
            chatroom.append('<p class="message">' + data.username + ': ' + data.message + '</p>')
        });

        send_username.click(function(){
            console.log(username.val());
            socket.emit('change_username', {username: username.val()})
        });

    });
};
