
// const express = require('express');
// const mongoose = require('mongoose');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcryptjs'); // Imported all necessary modules
// const dotenv = require('dotenv');
// const cors = require('cors');
// const axios=require('axios');
// // Configure dotenv to access environment variables
// dotenv.config();

// const app = express();
// const PORT = 5000

// // Middleware setup
// app.use(cors());
// app.use(bodyParser.json());
// let userInfo=null;
// // Connect to MongoDB
// mongoose.connect(process.env.MONGO_URI2, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// })
// .then(() => console.log('Connected to MongoDB'))
// .catch((err) => console.error('Could not connect to MongoDB:', err));

// // Define the User schema and model
// const UserSchema = new mongoose.Schema({
//     username: { type: String, required: true, unique: true },
//     password: { type: String, required: true } // Store hashed passwords
// });

// const User = mongoose.model('User', UserSchema);

// // Login route
// app.post('/api/auth/login', async (req, res) => {
//     const {username,password} = req.body;
//     console.log("Data received on server 5000:",username,password);
//     try {
//         // const response=await axios.post('http://localhost:')
//         const user = await User.findOne({ username });
//         if (!user) return res.status(400).json({ message: "Invalid username" });

//         const isMatch = await bcrypt.compare(password, user.password);
//         if (!isMatch) return res.status(400).json({ message: "Invalid password" });
//         if(isMatch){
//             userInfo={Username:username,Password:password};
//             try{
//                 const response=await axios.post("http://localhost:7000/receive-data",userInfo);
//                 console.log("User info sent to server 7000: ",response.data);
//             }catch(err){
//                 console.error("Failed to send user info to server 7000:",err);
//             }
//         }
//         return res.json({ message: "Login successful" });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });
// app.post('/user-info',async(req,res)=>{
//     if(!userInfo){
//         return res.send("No User is logged in");
//     }
//     const resentUser={
//         Username:userInfo.Username,
//         Password:userInfo.Password,
//     }
    
//     try{
//         const response=await axios.post("http://localhost:7000/receive-data",resentUser);
//         console.log(`Data has been sent successfully! Username:${resentUser.Username}, Password: ${resentUser.Password}`);
//         res.send(`Username and password has been sent, Response from Server 7000: ${response.data}`);
//     }catch(error){
//         console.log("Error sending data: ",error.message);
//         res.status(500).send("Failed to send data to 4000");
//     }
// });

// // Start the server
// app.listen(PORT, () => {
//     console.log(`Server is running on  http://localhost:${PORT}`);
// });


const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI1, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Could not connect to MongoDB:', err));
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        console.log("Connecting to MongoDB...");
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log("Username already taken");
            return res.status(400).json({ message: "Username already taken" });
        }
        
        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("Creating new user...");
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        console.log("User registered successfully");
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error during registration process:", error);  // Log the specific error
        res.status(500).json({ message: "Server error", error: error.message });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: "Invalid username" });

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid password" });

        res.json({ message: "Login successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post('/user-info',async(req,res)=>{
    if(!userInfo){
        return res.send("No User is logged in");
    }
    const resentUser={
        Username:userInfo.Username,
        Password:userInfo.Password,
    }
    
    try{
        const response=await axios.post("http://localhost:7000/receive-data",resentUser);
        console.log(`Data has been sent successfully! Username:${resentUser.Username}, Password: ${resentUser.Password}`);
        res.send(`Username and password has been sent, Response from Server 7000: ${response.data}`);
    }catch(error){
        console.log("Error sending data: ",error.message);
        res.status(500).send("Failed to send data to 4000");
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});