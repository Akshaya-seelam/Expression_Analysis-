import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { processImages } from './Model.mjs';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
const PORT = 7000;
const mongoUri1 = process.env.MONGO_URI1;
const mongoUri = process.env.MONGO_URI;

const corsOptions = {
  origin: ['http://localhost:3000','http://localhost:9000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use('/pi',express.static(path.join(process.cwd(),'uploads')));
// MongoDB Schema and Model for Counter
const CounterSchema = new mongoose.Schema({
  value: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', CounterSchema, 'counters'); // Explicitly specify the collection name as 'counters'

// Connect to MongoDB database specified in the URI
mongoose.connect(mongoUri1, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error('Connection error', error));

// Initialize counter in MongoDB if it doesn’t exist
const initializeCounter = async () => {
  const existingCounter = await Counter.findOne();
  if (!existingCounter) {
    const counter = new Counter({ value: 0 });
    await counter.save();
  }
};
initializeCounter();

// Directory for saving images
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Function to get the current counter value
const getCurrentCounterValue = async () => {
  const counterDoc = await Counter.findOne();
  return counterDoc ? counterDoc.value : null;
};
const checkStatus = async (sessionCounter) => {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const database = client.db('test');
    const collection = database.collection('status');
    
    const statusDoc = await collection.findOne({ Session_Id: sessionCounter });
    return statusDoc ? statusDoc.status : null;
  } catch (error) {
    console.error("Error checking status:", error);
    return null;
  } finally {
    await client.close();
  }
};
async function waitForData(sessionCounter) {
  let attempts = 0;
  const maxAttempts = 30;  // Limit the number of attempts to prevent infinite loops
  const delay = 5000; // 5 seconds delay between checks

  while (attempts < maxAttempts) {
    const status = await checkStatus(sessionCounter);
    
    if (status === "data_inserted") {
      console.log("Data inserted, proceeding with the operation.");
      return true;  // Data is ready, continue processing
    }

    console.log(`Data not yet inserted, retrying... (${attempts + 1}/${maxAttempts})`);
    attempts++;

    // Wait before trying again
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.log("Max attempts reached, data not inserted.");
  return false;  // Data was not inserted in the given attempts
}

// Endpoint to update the counter independently
app.post('/update-counter', async (req, res) => {
  try {
    // Increment the counter by 1
    const counterDoc = await Counter.findOneAndUpdate(
      {}, // Match the first document (or create a new one if none exists)
      { $inc: { value: 1 } }, // Increment the value field by 1
      { new: true, upsert: true } // Return the updated document
    );
    res.status(200).json({ message: 'Counter updated successfully', counter: counterDoc.value });
  } catch (error) {
    console.error("Error updating counter:", error);
    res.status(500).json({ error: 'Failed to update counter' });
  }
});

let imageCount = 0;
let imagePaths = [];

async function insertImagePaths(pathsArray, sessionCounter) {//image paths-------------------<
  const client = new MongoClient(mongoUri);
  console.log("Inserting paths into MongoDB. Paths:", pathsArray);
  try {
    await client.connect();
    console.log("Connected to MongoDB client for direct insertion.");
    const database = client.db('test');
    const collection = database.collection('datas');
    const status = await checkStatus(sessionCounter);
    if(status=="data_inserted"){
      const result=await collection.updateOne({Session_Id:sessionCounter},{$set:{Player_images:pathsArray}});
      if(result.acknowledged){
        console.log(`Update acknowledged: ${result.acknowledged}`);
        if(result.modifiedCount){
          console.log(`Document was updated. Modified count: ${result.modifiedCount}`)
        }
        else{
          console.log('No documents were updated (perhaps the data was the same).');
        }
      }else{
        console.log("Update was not acknowledged");
      }
    }
    
    
    // const document = {
    //   paths: pathsArray,
    //   session: sessionCounter,
    //   __v: 0
    // };

    // const result = await collection.insertOne(document);
    // console.log('Document inserted with _id:', result.insertedId);
  } catch (error) {
    console.error('Error inserting document:', error);
  } finally {
    await client.close();
    console.log("MongoDB client connection closed.");
  }
}

app.post('/uploads', async (req, res) => {
  const base64Image = req.body.image;
  if (!base64Image) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  // Get the current counter value (the session number)
  let counterValue;
  try {
    counterValue = await getCurrentCounterValue(); // Ensure this function is defined and fetches the session counter
    if (counterValue === null) {
      return res.status(500).json({ error: 'Counter not initialized' });
    }
  } catch (error) {
    console.error('Error accessing counter:', error);
    return res.status(500).json({ error: 'Failed to access counter' });
  }

  // Increment the image count for unique naming
  imageCount++;

  // Define the filename with the incremented image count and session value
  const filename = `Session${counterValue}_Image${imageCount}.png`;
  const filepath = path.join(uploadDir, filename);

  // Save the image to the uploads folder
  const base64Data = base64Image.replace(/^data:image\/png;base64,/, "");
  fs.writeFile(filepath, base64Data, 'base64', async (err) => {
    if (err) {
      console.error('Error saving image:', err);
      return res.status(500).json({ error: 'Failed to save image' });
    }
    // Generate a relative path for MongoDB storage ../../../Backend/uploads/
    const relativePath = `http://localhost:7000/pi/${filename}`;
    imagePaths.push(relativePath);

    console.log(`User image saved as ${filename}, added to session paths.`);

    res.status(200).json({ message: 'User Image uploaded successfully', filename });
  });
});

// Route to trigger model processing (optional, based on your initial setup)
//------------------------------*************************-------------------------------------------
app.post('/trigger-model', async (req, res) => {//Receiving the data
  try {
      // const currentSession = await getCurrentCounterValue(); // Retrieve current session value
      const {Session_Id}=req.body;
      if (!Session_Id) {
          return res.status(400).json({ error: 'Did not receive the session_Id' });
      }

      console.log(`Triggering model for Session ${Session_Id}`);
      await processImages(Session_Id); // Pass session value to processImages

      res.status(200).json({ message: `Model processing triggered for Session ${Session_Id}` });
  } catch (error) {
      console.error("Error triggering model:", error);
      res.status(500).json({ error: 'Failed to trigger model' });
  }
});

app.post('/end-session1', async (req, res) => {
  let counterValue;
  try {
    counterValue = await getCurrentCounterValue();
    if (counterValue === null) {
      return res.status(500).json({ error: 'Counter not initialized' });
    }
  } catch (error) {
    console.error('Error accessing counter:', error);
    return res.status(500).json({ error: 'Failed to access counter' });
  }

  // Wait for the main server to insert the data
  const isDataReady = await waitForData(counterValue);
  
  if (!isDataReady) {
    return res.status(400).json({ error: 'Data not ready to process yet' });
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const database = client.db('test');
    const collection = database.collection('datas');

    // Check if a document already exists for the current session
    const existingDocument = await collection.findOne({ Session_Id: counterValue });
    
    if (imagePaths.length > 0) {
      await insertImagePaths(imagePaths, counterValue);
      imagePaths = [];
      imageCount = 0;
      console.log('Session images successfully saved to MongoDB and cleared from memory.');
      res.status(200).json({ message: 'Session images saved to MongoDB' });
    } else {
      console.log('No images to save. Skipping MongoDB insertion.');
      res.status(400).json({ error: 'No images found for session.' });
    }
  } catch (error) {
    console.error('Error during session save:', error);
    res.status(500).json({ error: 'Failed to save session' });
  } finally {
    await client.close();
    console.log("MongoDB client connection closed.");
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// app.post('/end-session1', async (req, res) => {//images paths---------------------<
//   let counterValue;
//   try {
//     counterValue = await getCurrentCounterValue();
//     if (counterValue === null) {
//       return res.status(500).json({ error: 'Counter not initialized' });
//     }
//   } catch (error) {
//     console.error('Error accessing counter:', error);
//     return res.status(500).json({ error: 'Failed to access counter' });
//   }

//   const client = new MongoClient(mongoUri);
//   try {
//     await client.connect();
//     const database = client.db('test');
//     const collection = database.collection('datas');

//     // Check if a document already exists for the current session
//     const existingDocument = await collection.findOne({ Session_Id: counterValue });
    
//     if (imagePaths.length > 0) {
//       await insertImagePaths(imagePaths, counterValue);
//       imagePaths = [];
//       imageCount = 0;
//       console.log('Session images successfully saved to MongoDB and cleared from memory.');
//       res.status(200).json({ message: 'Session images saved to MongoDB' });
//     } else {
//       console.log('No images to save. Skipping MongoDB insertion.');
//       res.status(400).json({ error: 'No images found for session.' });
//     }
//   } catch (error) {
//     console.error('Error during session save:', error);
//     res.status(500).json({ error: 'Failed to save session' });
//   } finally {
//     await client.close();
//     console.log("MongoDB client connection closed.");
//   }
// });

// Start the server