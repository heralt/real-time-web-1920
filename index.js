const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch');

app.set('view engine', 'ejs');
app.use(express.static('static'));

app.get('/', (req, res) => {
    res.render('index');
});

const PLAYLIST_ID = '71LMuR914gr93PYJweS7lO';

let queuedSongs = 0;

io.on('connection', (socket) => {

    let {username} = socket;
    username = "Anonymous";

    socket.on('other event', (data) => {
        console.log(data)
    });

    socket.on('connected',() => {
        socket.emit('playlistID',{
            playlistID: PLAYLIST_ID
        });
    });

    socket.on('click song', (data) => {
        let url = `https://api.spotify.com/v1/tracks/${data.songID}`;
        fetch(url,{
            headers: {
                'Authorization': 'Bearer ' + data.access
            }
        }).then(response => {
            return response.json();
        }).then(result => {
            io.sockets.emit('add song',{
                song: result,
                playlist: PLAYLIST_ID,
            });
        });
    });

    socket.on('click song que', (data) => {
        console.log('que', socket.id);
        let url = `https://api.spotify.com/v1/tracks/${data.songID}`;
        fetch(url,{
            headers: {
                'Authorization': 'Bearer ' + data.access
            }
        }).then(response => {
            return response.json();
        }).then(result => {
            io.emit('queue song',{
                song: result,
                playlist: PLAYLIST_ID
            });
        });
    });

    socket.on('queued songs',()=>{
        queuedSongs +=1;
        io.sockets.emit('queued songs',{
           queued: queuedSongs
       });
    });

    socket.on('queued played',()=>{
        queuedSongs -=1;
        io.sockets.emit('queued songs',{
            queued: queuedSongs
        });
    });

    socket.on('song no active', (data) => {
        socket.emit('change state',{
            state: data.state
        })
    });

    socket.on('new_message', (data) => {
        io.sockets.emit('new_message', {message: data.message, username: username});
    });

    socket.on('change_username', (data) => {
        username = data.username;
    });

    socket.on('disconnect', () => {
        console.log('someone left')
    });
});

const server = http.listen(process.env.PORT || 3000);