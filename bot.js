//This is the main script for the bot. To start the bot, run this script with node
const Discord = require("discord.js");
const discord_auth = require('./auth.json');

const bot = new Discord.Client();

const prefix = "!";
// My ID :^)
const master_id = "127060142935113728";

let queue = {};

//Dependencies
const fs = require('fs');
const child_process = require('child_process');
const yt = require('ytdl-core');
const d20 = require('d20');


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

var getMethod = (argument) => {
	//Grab first word in a command
	if(argument.indexOf(' ') != -1){
		return argument.split(' ')[0];
	}else{
		return argument;
	}
}

var getParameter = (argument) => {
	return argument.substring(argument.indexOf(' ')+1, argument.length);
}


const commands = {
	'ping': {
		process: (msg, argument) => {
			msg.channel.sendMessage(msg.author + " pong!");
			console.log(`${bot.timestamp()} ${msg.author.username} pinged the bot`);
		},
		description: "Check if the bot is online."
	},
	'help': {
		process: (msg, argument) => {
			let commandList = 'Available Commands:```'
			for (cmd in commands) {
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
		process: (msg, argument) => {
			valid = argument.replace(/[^d0-9\s\+\*\\\-]/g, "");
			output = d20.roll(valid, false);
			msg.reply(output);
		},
		usage: "<d20 syntax>",
		description: "Roll dice using d20 syntax"
	},
	'say': {
		process: (msg, argument) => {
			msg.channel.sendMessage(argument);
		},
		usage: "<string>",
		description: "Make the bot say something"
	},
	'kill': {
		process: (msg, argument) => {
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
		process: (msg,argument) => {
			msg.channel.sendMessage("Bot courtesy of ");
		},
		description: "Credits for the bot."
	},
	'update': {
		process: (msg,argument)=> {
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
		}
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
}


bot.login(discord_auth.token);

bot.on('ready', ()=> {
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
		let command = msg.content.substring(msg.content.indexOf(prefix),msg.content.length).trim();
		if (command.startsWith(prefix)) {
			//Get command to execute
			let to_execute = command.split(prefix).slice(1).join().split(' ')[0];
			//Get string after command
			let argument = command.split(prefix).slice(1).join().split(' ').slice(1).join(" ");
			if (commands[to_execute]) {
				commands[to_execute].process(msg, argument);
			}
		}
	}
})

bot.on('guildMemberAdd', (guild, member) => {
	console.log(`${bot.timestamp()} user ${member.user.username} joined channel.`)
	guild.channels.find('position',1).sendMessage(`Welcome to the unofficial Gamescape North Discord, ${member}!`);
})


module.exports = bot;
