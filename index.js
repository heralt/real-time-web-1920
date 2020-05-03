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

io.on('connection', (socket) => {
    socket.emit('news', {hello: 'yo'});

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

    socket.on('song active', (data) => {
        socket.emit('change state',{
            state: data.state
        })
    });

    socket.on('disconnect', () => {
        console.log('someone left')
    });
});

const server = http.listen(process.env.PORT || 3000);