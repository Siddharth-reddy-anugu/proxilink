const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3000;

const users = [
    { username: 'arsh', password: 'arsh1' },
    { username: 'paras', password: 'paras1' },
    { username: 'yaswanth', password: 'yaswanth1' },
    { username: 'siddharth', password: 'siddharth1' },
    { username: 'hymad', password: 'hymad1' } 
];

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

let authenticatedUsers = {};

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        authenticatedUsers[username] = { socketId: null, group: null };
        return res.json({ message: 'Login successful', username });
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/public/chat.html');
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({ message: 'File uploaded successfully', filePath: req.file.path });
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = __dirname + '/uploads/' + filename;

    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

let groups = {};

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    socket.on('joinGroup', (data) => {
        const { username, groupName } = data;

        if (!authenticatedUsers[username]) {
            socket.emit('message', 'You need to log in first.');
            return;
        }

        authenticatedUsers[username].socketId = socket.id;
        authenticatedUsers[username].group = groupName;

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(socket.id);

        socket.join(groupName);
        io.to(groupName).emit('message', `${username} has joined the group: ${groupName}`);
    });

    socket.on('sendMessage', (data) => {
        const { username, groupName, message } = data;
        io.to(groupName).emit('message', `${username}: ${message}`);
    });

    socket.on('sendFile', (fileData) => {
        const { username, groupName, filePath } = fileData;
        const filename = filePath.split('/').pop();

        console.log(`${username} shared a file: ${filePath} in group: ${groupName}`);
        io.to(groupName).emit('message', `${username} shared a file: <a href="/download/${filename}" download="${filename}">Download file</a>`);
    });

    socket.on('disconnect', () => {
        for (let username in authenticatedUsers) {
            if (authenticatedUsers[username].socketId === socket.id) {
                const groupName = authenticatedUsers[username].group;
                groups[groupName] = groups[groupName].filter(id => id !== socket.id);
                io.to(groupName).emit('message', `${username} has left the group: ${groupName}`);
                delete authenticatedUsers[username];
            }
        }

        console.log('A user disconnected with socket ID:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://<your-local-IP>:${PORT}`);
});
