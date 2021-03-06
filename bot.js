'use strict';

//This is the main script for the bot. To start the bot, run this script with node
const Discord = require("discord.js");
const discord_auth = require('./auth.json');

const bot = new Discord.Client();

const prefix = "!";
// My ID :^)
const master_id = "127060142935113728";
const calendar_ids = require('./calendar_ids.json')

let queue = {};

//Dependencies
const fs                   = require('fs');
const child_process        = require('child_process');
const yt                   = require('ytdl-core');
const d20                  = require('d20');
const PublicGoogleCalendar = require('public-google-calendar');
const schedule             = require('node-schedule');
const readline             = require('readline');

// //Knex database login
// const knex = require('knex')(require('./knexfile.js').development);

//bot methods
bot.checkRole = (msg, roleArr) => {
	for (var i = roleArr.length - 1; i >= 0; i--) {
		if (msg.guild.roles.find('name',roleArr[i]) != undefined) {
			let foundRole = msg.guild.roles.find('name',roleArr[i]);
			if (msg.member.roles.has(foundRole.id)){
				console.log(`${msg.author.username} has role ${roleArr[i]}`);
				return true;
			}
		} else {
			console.log(`WARNING! Role not found: ${roleArr[i]}`);
			return false;
		}
	}
	return false;
}
bot.reject = (msg)=> {
	msg.channel.sendCode('diff','- Access Denied\nThis incident will be reported');
	console.log(`${bot.timestamp()} ${msg.member.nickname} tried to use the command ${msg.cleanContent}`)
}

bot.timestamp = (msg) => {
	return `[ ${new Date()} ] -`;
}

//return Promise to resolve to array of Google Calendar event objects 
bot.fetchTodayEvents = (calendarObj)=> {
	return new Promise ((resolve,reject) => {
		let tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
		calendarObj.getEvents({
			endDate: tomorrow.getTime()
		},(err,events)=> {
			if (err) return reject(err);
			//chop down this astronomical array to length of 5, filter to see if it's today, then reverse to chronological
			let filtered = events.slice(0,4).filter(isToday).reverse();
			return resolve(filtered);
		})
	})
}

bot.setTodayEvents = ()=> {
	//Clear bot property
	bot._today = []

	var callstack = []
	//Create array of native Promises
	for (let cal in bot._calendars) {
		callstack.push(bot.fetchTodayEvents(bot._calendars[cal]))
	}
	//Resolve all Promises in callstack, passing 2D-array _allData_ of resolves from all Promises
	Promise.all(callstack)
	.then((allData)=> {
		//Decompose 2d array, pushing all event objects to bot._today property
		for (let i in allData) {
			if (allData[i].length>0) {
				for (let j in allData[i] ) {
					bot._today.push(allData[i][j])
				}
			}
		}
		var date = new Date()
		console.log(`Calendar set for ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`)
	})
	.catch((err)=> {
		console.log(err);
	})
}

const isToday = (eventObj) => {
	return (new Date().toDateString() === new Date(eventObj.start).toDateString())
}

const getMethod = (arg) => {
	//Grab first word in a command
	if (arg.indexOf(' ') != -1) {
		return arg.split(' ')[0];
	} else {
		return arg;
	}
}

const getParameter = (arg) => {
	return arg.substring(arg.indexOf(' ')+1, arg.length);
}

const formatAMPM = (date) => {
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var ampm = hours >= 12 ? 'pm' : 'am';
	hours = hours % 12;
	hours = hours ? hours : 12; // the hour '0' should be '12'
	minutes = minutes < 10 ? '0'+minutes : minutes;
	var strTime = hours + ':' + minutes + ' ' + ampm;
	return strTime;
}


const commands = {
	'ping': {
		process: (msg, arg) => {
			msg.channel.sendMessage(msg.author + " pong!");
			console.log(`${bot.timestamp()} ${msg.author.username} pinged the bot`);
		},
		description: "Check if the bot is online."
	},
	'help': {
		process: (msg, arg) => {
			let commandList = 'Available Commands:```'
			for (let cmd in commands) {
				if (!commands[cmd].discrete) {
					let command = prefix + cmd;
					let usage = commands[cmd].usage;
					if (usage) {
						command += " " + usage;
					}
					let description = commands[cmd].description;
					if(description){
						command += "\n\t" + description;
					}
					commandList+=command+"\n";
				}
			}
			commandList += "```\n";
			msg.author.sendMessage(commandList)
		},
		description: "Messages user list of commands"
	},
	'roll': {
		process: (msg, arg) => {
			var valid = arg.replace(/[^d0-9\s\+\*\\\-]/g, "");
			var output = d20.roll(valid, false);
			msg.reply(output);
		},
		usage: "<d20 syntax>",
		description: "Roll dice using d20 syntax"
	},
	'r': {
		process: (msg, arg)=> {
			commands.roll.process(msg,arg);
			return;
		},
		description: "Shorthand of roll command"
	},
	'say': {
		process: (msg, arg) => {
			msg.channel.sendMessage(arg);
		},
		usage: "<string>",
		description: "Make the bot say something"
	},
	'kill': {
		process: (msg, arg) => {
			if (msg.author.id === master_id) {
				msg.channel.sendMessage("*Beep boop, click*").then(()=> {
					console.log("Being shut down by " + msg.author.username);
					process.exit();
				});
			}  else {
				bot.reject(msg);
			}
		},
		description: "This kills the robot. Must have privileges to execute.",
		discrete: true
	},
	'info': {
		process: (msg,arg) => {
			msg.channel.sendMessage("Bot courtesy of ");
		},
		description: "Credits for the bot."
	},
	'update': {
		process: (msg,arg)=> {
			if (msg.author.id === master_id) {
				msg.channel.sendMessage("fetching updates...").then(function(sentMsg){
					console.log("updating...");
					var spawn = require('child_process').spawn;
					var log = function(err,stdout,stderr){
						if(stdout){console.log(stdout);}
						if(stderr){console.log(stderr);}
					};
					var fetch = spawn('git', ['fetch']);
					fetch.stdout.on('data',function(data){
						console.log(data.toString());
					});
					fetch.on("close",function(code){
						var reset = spawn('git', ['pull','origin/master']);
						reset.stdout.on('data',function(data){
							console.log(data.toString());
						});
						reset.on("close",function(code){
							var npm = spawn('npm', ['install']);
							npm.stdout.on('data',function(data){
								console.log(data.toString());
							});
							npm.on("close",function(code){
								console.log("goodbye");
								sentMsg.edit("brb!").then(function(){
									bot.destroy().then(function(){
										process.exit();
									});
								});
							});
						});
					});
				});
			}
		},
		discrete:true
	},
	'play': {
		process: (msg) => {
			if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Add some songs to the queue first with ${prefix}add`);
			if (!msg.guild.voiceConnection) {
				return commands['join'].process(msg).then(() => {
					commands['play'].process(msg);
					return;
				});
			}
			if (queue[msg.guild.id].playing) return msg.channel.sendMessage('Already Playing');
			let dispatcher;
			queue[msg.guild.id].playing = true;

			(function play(song) {
				if (!queue[msg.guild.id].looping && song.title != undefined){
					msg.channel.sendMessage(`Playing: **${song.title}** as requested by: **${song.requester}**`);
				}
				dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : 1 });
				queue[msg.guild.id].songs.shift();
				let collector = msg.channel.createCollector(m => m);
				collector.on('message', m => {
					if (m.content.startsWith(prefix + 'pause')) {
						msg.channel.sendMessage('paused').then(() => {dispatcher.pause();});
					} else if (m.content.startsWith(prefix + 'resume')) {
						msg.channel.sendMessage('resumed').then(() => {dispatcher.resume();});
					} else if (m.content.startsWith(prefix + 'skip')) {
						msg.channel.sendMessage('skipped').then(() => {
							queue[msg.guild.id].looping=false;
							dispatcher.end();
						});
					} else if (m.content.startsWith(prefix + 'volume+')) {
						if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
						dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
						msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(prefix + 'volume-')){
						if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
						dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
						msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(prefix + 'time')){
						msg.channel.sendMessage(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
					} else if (m.content.startsWith(prefix + 'loop')){
						msg.channel.sendMessage(`Looping **${song.title}**. To exit loop, use ${prefix}skip`).then(()=>{queue[msg.guild.id].looping=true})
					}
				});
				dispatcher.on('end', () => {
					collector.stop();
					if (queue[msg.guild.id].looping) {
						play(song);
					}  else {
						play(queue[msg.guild.id].songs[0]);
					}
				});
				dispatcher.on('error', (err) => {
					return msg.channel.sendMessage('error: ' + err).then(() => {
						collector.stop();
						queue[msg.guild.id].songs.shift();
						play(queue[msg.guild.id].songs[0]);
					});
				});
			})(queue[msg.guild.id].songs[0]);
		},
		description: "Make Musicbot play the song queue in current voice channel.",
		discrete: true
	},
	'join': {
		process: (msg) => {
			return new Promise((resolve, reject) => {
				const voiceChannel = msg.member.voiceChannel;
				if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply('I couldn\'t connect to your voice channel...');
				voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
			});
		},
		description: "Musicbot joins your channel.",
		discrete: true
	},
	'add': {
		process: (msg) => {
			let url = msg.content.split(' ')[1];
			if (url == '' || url === undefined) return msg.channel.sendMessage(`You must add a url, or youtube video id after !add`);
			yt.getInfo(url, (err, info) => {
				if(err) return msg.channel.sendMessage('Invalid YouTube Link: ' + err);
				if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
				queue[msg.guild.id].defaulting = false;
				queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username});
				msg.channel.sendMessage(`added **${info.title}** to the queue`);
			});
		},
		description: "Add youtube link to music queue.",
		discrete: true
	},
	'queue': {
		process: (msg) => {
			if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Add some songs to the queue first with !add`);
			let tosend = [];
			queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
			msg.channel.sendMessage(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
		},
		description: "View music queue.",
		discrete: true
	},
	'cal': {
		process: (msg, arg) => {
			if (bot._today.length===0) {
				// msg.channel.sendMessage("No events today.")
			} else {
				var date = new Date()
				var response = `Calendar for ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}:\`\`\``
				for (let i in bot._today) {
					response+=`\n${formatAMPM(new Date(bot._today[i].start))} ${bot._today[i].summary}`;
				}
				response+="```"
				msg.channel.sendMessage(response)
			}
		},
		description: "Get today's events at GS"
	}
}


bot.login(discord_auth.token);

bot._today;


bot.on('ready', ()=> {
	//Self-invoking function to collect Google Calendar files onload
	(function fetchCalendarFiles(){
		process.stdout.write("Fetching calendar files...");
		bot._calendars = {}
		for (let id in calendar_ids) {
			bot._calendars[id] = new PublicGoogleCalendar({ 
				calendarId: calendar_ids[id]
			});
		}
		readline.clearLine(process.stdout);
		readline.cursorTo(process.stdout, 0);
		process.stdout.write("Calendars files loaded.\n");
	})()

	bot.setTodayEvents()

	var calRefreshJob = schedule.scheduleJob('* * 0 * * *', ()=>{
		bot.setTodayEvents();
	});

	bot.user.setStatus(`online`,`Say ${prefix}help`)
	.then((user)=> {
		console.log(`${bot.timestamp()} Smonk Online\n---`)
	})
	.catch((err) =>{
		console.log(err);
	});

})

bot.on('message', (msg) => {
	// if not something the bot cares about, exit out
	if(msg.author.bot||msg.system||msg.tts||msg.channel.type === 'dm'||!msg.content.startsWith(prefix)) return;
	if(msg.content.startsWith(prefix)) {
		//Trim the mention from the message and any whitespace
		let command = msg.content.trim();
		//Get command
		let to_execute = command.split(' ')[0].slice(prefix.length);
		//Get string after command
		let arg = command.split(' ').slice(1).join(" ");

		//If command exists, execute. Else, send warning that will be deleted in 3 seconds.
		commands[to_execute] ? commands[to_execute].process(msg, arg) : msg.channel.sendMessage(`Command ${to_execute} not found.`).delete(3000);
	}
})

bot.on('guildMemberAdd', (member) => {
	console.log(`${bot.timestamp()} user ${member.user.username} joined channel.`)
	member.guild.channels.find('position',1).sendMessage(`Welcome to the unofficial Gamescape North Discord, ${member}!`);
})


module.exports = bot;
