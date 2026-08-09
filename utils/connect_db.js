const mongoose = require("mongoose")

function connectDb(dbUrl){
    console.log(dbUrl)
    mongoose.connect(dbUrl).then((ans) => {
        console.log("ConnectedSuccessful")
    }).catch((err) => {
        console.log("Error in the Connection")
    })
}

module.exports={
    connectDb,
}