const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()

module.exports = () => {
    const databaseParams = {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
    try{
        //console.log("Mongo URI:", process.env.MONGODB_URI);
        mongoose.connect(process.env.DB_URL)
        console.log("The backend has connected to the MongoDB database.")
    } catch(error){
        console.log(`${error} could not connect`)
    }
}

