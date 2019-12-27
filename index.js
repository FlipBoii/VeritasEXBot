var util = require('util');
var querystring = require('querystring');
var request = require('request');
var nodemailer = require('nodemailer');
var bottleneck = require("bottleneck/es5");
var formatCurrency = require('format-currency')
var Discord = require('discord.js');
var APIUrl = "https://poring.world/api/search";

var client = new Discord.Client();

var limiter = new bottleneck({
  maxConcurrent: 1,
  minTime: 300
});

var text = '';
var textArray = [];
var mainResult = [];
request = util.promisify(request);

async function sendNotification(){
    return new Promise(async(resolve, reject)=>{
        try{
            if(mainResult.length > 0){

                //let text = '';

                for(let i = 0; i < mainResult.length; i++){

                    let convdataTime = 'Not on snap';

                    if(parseInt(mainResult[i].snap) > 0){
                        // Unixtimestamp
                        let unixtimestamp = parseInt(mainResult[i].snap);

                        // Months array
                        let months_arr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                        // Convert timestamp to milliseconds
                        let date = new Date(unixtimestamp*1000);

                        // Year
                        let year = date.getFullYear();

                        // Month
                        let month = months_arr[date.getMonth()];

                        // Day
                        let day = date.getDate();

                        // Hours
                        let hours = date.getHours();

                        // Minutes
                        let minutes = "0" + date.getMinutes();

                        // Seconds
                        let seconds = "0" + date.getSeconds();

                        // Display date time in MM-dd-yyyy h:m:s format
                        convdataTime = month+'-'+day+'-'+year+' '+hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

                    }

                    let str = 'Item: '+mainResult[i].item+"\n"+'Price: '+formatCurrency(mainResult[i].price)+"\n"+'Stock: '+mainResult[i].stock+"\n"+(parseInt(mainResult[i].snap) > 0 ? 'Buyers: '+mainResult[i].buyers+"\n" : '')+'Snap End: '+convdataTime+"\n\n";

                    if(text.length + str.length > 2000){
                      textArray.push(text);
                      text = str;
                    }else{
                      text = text + str;
                    }

                    if(i === mainResult.length - 1){
                      textArray.push(text);
                    }
                }


            }

            resolve('');
        }catch(e){
            console.log(e);
        }

    });
}

async function filterExpired(results,key){
    return new Promise(async(resolve, reject)=>{
        try{

            for(let i = 0; i < results.length; i++){
                    let date = Date.now();
                    let category = results[i].category.toLowerCase().trim();
                    if(results[i].lastRecord.snapEnd*1000 > date && (key.trim() == '' || category.indexOf(key.toLowerCase()) != -1) ){
                      mainResult.push({
                          id: results[i].id,
                          item: results[i].name,
                          price: results[i].lastRecord.price,
                          stock: results[i].lastRecord.stock,
                          snap: results[i].lastRecord.snapEnd,
                          buyers: results[i].lastRecord.snapBuyers
                      });
                    }else{

                    }
            }
            console.log(mainResult);
            resolve('');

        }catch(e){
            console.log(e);
        }
    });
}

async function justGetEverything(results,key){
    return new Promise(async(resolve, reject)=>{
        try{

            for(let i = 0; i < results.length; i++){
                    let date = Date.now();
                    let category = results[i].category.toLowerCase().trim();
                    if((results[i].lastRecord.snapEnd == 0 || results[i].lastRecord.snapEnd*1000 > date) && (key.trim() == '' || category.indexOf(key.toLowerCase()) != -1) ){
                      mainResult.push({
                          id: results[i].id,
                          item: results[i].name,
                          price: results[i].lastRecord.price,
                          stock: results[i].lastRecord.stock,
                          snap: results[i].lastRecord.snapEnd,
                          buyers: results[i].lastRecord.snapBuyers
                      });
                    }else{

                    }
            }
            console.log(mainResult);
            resolve('');

        }catch(e){
            console.log(e);
        }
    });
}

async function runByCategory(key){
    return new Promise(async(resolve, reject)=>{
        try{

            text = '';
            textArray = [];
            mainResult = [];

            let requestData = {
                order: 'popularity',
                rarity: '',
                inStock: 1,
                modified: '',
                category: '',
                endCategory: ''
            }

            let options = {
                method: 'GET',
                url: APIUrl+'?'+querystring.stringify(requestData),
            };

            let response = await request(options);

            if(response.statusCode !== 200){
                resolve('');
            }else{
                let results = JSON.parse(response.body);

                await filterExpired(results,key);

                resolve('');
            }

        }catch(e){
            console.log(e);
        }
    });
}

async function runByItem(key){
    return new Promise(async(resolve, reject)=>{
        try{

            text = '';
            textArray = [];
            mainResult = [];

            let requestData = {
                order: 'popularity',
                rarity: '',
                inStock: 1,
                modified: '',
                category: '',
                endCategory: '',
                q: key
            }

            let options = {
                method: 'GET',
                url: APIUrl+'?'+querystring.stringify(requestData),
            };

            let response = await request(options);

            if(response.statusCode !== 200){
                resolve('');
            }else{
                let results = JSON.parse(response.body);

                await justGetEverything(results,'');

                resolve('');
            }

        }catch(e){
            console.log(e);
        }
    });
}

client.on('ready', () => {
  console.log("READY!!");
});


client.on('message', message => {

  if (message.content.startsWith('!ex')) {
      let key = message.content.split('!ex');
      key = key[1].trim();

      if(key.toLowerCase().startsWith('help')){
        let instructions = '';
        instructions = "Type: !ex weapon | armor etc..\n";
        instructions += "Result: retrieve currently item category on snap\n";
        instructions += "\n";
        instructions += "Type: !ex find <item>\n";
        instructions += "Result: retrieve everything matching item.\n";

        message.channel.send(instructions);
      }else if(key.toLowerCase().startsWith('find')){
        key = key.toLowerCase().split('find');
        key = key[1].trim();

        runByItem(key).then(sendNotification).then(function(){
          for(let i = 0; i < textArray.length; i++){
            message.channel.send(textArray[i]);
          }

          if(textArray.length == 0){
            message.channel.send("Item not found.\n");
          }

        });
      }else if(key !== ''){
        runByCategory(key).then(sendNotification).then(function(){
          for(let i = 0; i < textArray.length; i++){
            message.channel.send(textArray[i]);
          }

          if(textArray.length == 0){
            message.channel.send("Nothing found in that category.\n");
          }

        });
      }
  }
});

//PLACE CLIENT ID HERE
client.login('NjU2MzE4NTA1NzMzMzI0ODMy.Xfg-2A.UFhV1L9Tl29R94tNgjUGcD2KzFA');
