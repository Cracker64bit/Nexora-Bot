require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, SelectMenuBuilder, SelectMenuOptionBuilder } = require('discord.js');
const { Octokit } = require('@octokit/rest');
const cheerio = require('cheerio');
const fs = require('fs');
const fetch = require('node-fetch');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
    ],
});

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1370380960943702077';
const WELCOME_CHANNEL_ID = '1387853749430648904';
const TICKET_BUTTON_ID = 'create_ticket';
const CLOSE_TICKET_BUTTON_ID = 'close_ticket';
const DELETE_TICKET_BUTTON_ID = 'delete_ticket';
const VERIFY_BUTTON_ID = 'verify_button';

const channelIds = {
    windows: '1370380921546473514',
    macos: '1370380935811436665',
    linux: '1370717419114598521',
    android: '1370380929683689523',
    ios: '1370380933185667092',
};

const systems = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    android: 'Android',
    ios: 'iOS',
    scripthub: 'Multi-Platform',
};

const statusMap = {
    up: { emoji: '🟢', description: 'Up and working great' },
    down: { emoji: '🔴', description: 'Down (patched because of an update)' },
    api: { emoji: '🔵', description: 'API is under fixes and might be still working' },
    big: { emoji: '🟡', description: 'Big update is coming and might be still working' },
    longtime: { emoji: '⚫', description: 'Might be down for a while' },
    comingsoon: { emoji: '🟠', description: 'Coming soon!' },
};

const welcomeMessages = [
    "Welcome to Nexora! We're thrilled to have you here! 🎉🔥",
    "Welcome to Nexora! Let’s ignite your journey! ✨🚀",
    "Welcome to Nexora! Ready to blaze a trail with us? 🌟💥",
    "Welcome to Nexora! Your adventure starts now! 🎊⚡",
    "Welcome to Nexora! We’re so excited to see you! 🥳🌈",
    "Welcome to Nexora! Let’s make some magic together! 🪄✨",
    "Welcome to Nexora! The party just got started! 🎈🎁",
    "Welcome to Nexora! Get ready for an amazing ride! 🚀🌟",
    "Welcome to Nexora! We’ve been waiting for you! 💖🎉",
    "Welcome to Nexora! Let’s set the server on fire! 🔥⚡",
    "Welcome to Nexora! Your journey begins here! 🌍✨",
    "Welcome to Nexora! We’re so glad you’re here! 🥰🎊",
    "Welcome to Nexora! Ready to shine bright? 🌟💡",
    "Welcome to Nexora! Let’s make things happen! 💪🔥",
    "Welcome to Nexora! A warm welcome to you! ☀️🎉",
    "Welcome to Nexora! Join the fun and excitement! 🎈⚡",
    "Welcome to Nexora! We’re pumped to have you! 🚀🎁",
    "Welcome to Nexora! Let’s create something awesome! 🛠️✨",
    "Welcome to Nexora! The community just got better! 💖🌟",
    "Welcome to Nexora! Dive in and explore! 🌊🎉",
];

const WHITELIST_FILE = 'whitelist.json';
const AFK_FILE = 'afk.json';
let whitelistData = { semiWhitelist: [], fullWhitelist: [] };
let afkData = {};

if (fs.existsSync(WHITELIST_FILE)) {
    whitelistData = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
} else {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelistData, null, 2));
}

if (fs.existsSync(AFK_FILE)) {
    afkData = JSON.parse(fs.readFileSync(AFK_FILE, 'utf8'));
} else {
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkData, null, 2));
}

function saveWhitelistData() {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelistData, null, 2));
}

function saveAfkData() {
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkData, null, 2));
}

async function sendLogEmbed(guild, title, description, fields = [], color = 0xFF0000) {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending log embed:', error);
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    console.log(`Received message: "${message.content}"`);

    if (message.mentions.users.size > 0) {
        for (const [userId, afkInfo] of Object.entries(afkData)) {
            if (message.mentions.users.has(userId) && userId !== message.author.id) {
                const reason = afkInfo.reason || 'No reason provided';
                await message.reply(`${message.mentions.users.get(userId).tag} is AFK: ${reason}`);
            }
        }
    }

    if (afkData[message.author.id]) {
        delete afkData[message.author.id];
        saveAfkData();
        await message.reply('Your AFK status has been removed!');
    }

    if (!message.content.startsWith(PREFIX)) {
        console.log(`Message does not start with prefix: "${PREFIX}"`);
        return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    console.log(`Processing command: "${command}" with args: "${args.join(' ')}"`);

    const { guild, member, channel, author: user } = message;

    const isServerOwner = guild.ownerId === user.id;
    const hasFullControl = isServerOwner || whitelistData.fullWhitelist.includes(user.id);
    const hasSemiControl = whitelistData.semiWhitelist.includes(user.id);

    try {
        if (command === 'whitelist') {
            if (!isServerOwner) {
                return message.reply('Only the server owner can use this command!');
            }

            if (args.length < 2) {
                return message.reply('Usage: !whitelist <type> <user>\nExample: !whitelist semi @user');
            }

            const type = args[0].toLowerCase();
            const targetUser = message.mentions.users.first();

            if (!targetUser) {
                return message.reply('Please mention a user to whitelist!');
            }

            if (type === 'semi') {
                if (whitelistData.semiWhitelist.includes(targetUser.id)) {
                    return message.reply(`${targetUser.tag} is already in the semi whitelist!`);
                }
                whitelistData.semiWhitelist.push(targetUser.id);
                await message.reply(`${targetUser.tag} has been added to the semi whitelist (can use !kick and !timeout).`);
                await sendLogEmbed(guild, 'User Semi Whitelisted', `${targetUser.tag} was added to the semi whitelist by ${user.tag}.`, [
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                ], 0x00FF00);
            } else if (type === 'full') {
                if (whitelistData.fullWhitelist.includes(targetUser.id)) {
                    return message.reply(`${targetUser.tag} is already in the full whitelist!`);
                }
                whitelistData.fullWhitelist.push(targetUser.id);
                await message.reply(`${targetUser.tag} has been added to the full whitelist (can control all bot commands).`);
                await sendLogEmbed(guild, 'User Fully Whitelisted', `${targetUser.tag} was added to the full whitelist by ${user.tag}.`, [
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                ], 0x00FF00);
            } else {
                return message.reply('Invalid type! Use "semi" or "full".\nExample: !whitelist semi @user');
            }

            saveWhitelistData();
            return;
        }

        if (['kick', 'timeout'].includes(command) && !hasFullControl && !hasSemiControl) {
            return message.reply('You need to be in the semi or full whitelist to use this command!');
        }

        if (['cmd', 'ban', 'ticket', 'ticketpanel', 'status', 'downloads', 'purge', 'userinfo', 'serverinfo', 'lock', 'unlock', 'slowmode', 'roleadd', 'roleremove', 'announce', 'vpanel'].includes(command) && !hasFullControl) {
            return message.reply('You need to be in the full whitelist or be the server owner to use this command!');
        }

        if (command === 'cmd') {
            const commands = [
                { name: '!whitelist <type> <user>', value: 'Whitelists a user to control the bot (Server Owner only). "semi" allows !kick and !timeout; "full" allows all commands.' },
                { name: '!cmd', value: 'Lists all available commands (requires full whitelist or server owner).' },
                { name: '!kick <user> [reason]', value: 'Kicks a user from the server with an optional reason (requires Kick Members permission; semi or full whitelist).' },
                { name: '!ban <user> [reason]', value: 'Bans a user from the server with an optional reason (requires Ban Members permission; full whitelist only).' },
                { name: '!timeout <user> <duration> [reason]', value: 'Times out a user for the specified duration (in minutes) with an optional reason (requires Moderate Members permission; semi or full whitelist).' },
                { name: '!status <system> <status>', value: 'Updates the status of a system (e.g., windows, macos). Available statuses: up, down, api, big, longtime, comingsoon (full whitelist only).' },
                { name: '!downloads <target> <action> [link]', value: 'Updates the download link for a specific Vortex system. If action is "update" with no link, sets to "update". Systems: windows, macos, linux, android, ios, scripthub (full whitelist only).' },
                { name: '!ticketpanel [channel]', value: 'Creates a ticket panel in the specified channel (or current channel if none specified) (requires Manage Channels permission; full whitelist only).' },
                { name: '!purge <amount>', value: 'Deletes a specified number of messages in the current channel (requires Manage Messages permission; full whitelist only).' },
                { name: '!userinfo [user]', value: 'Displays information about a user (or yourself if no user specified) (full whitelist only).' },
                { name: '!serverinfo', value: 'Displays information about the server (full whitelist only).' },
                { name: '!afk [reason]', value: 'Sets your AFK status with an optional reason. Mentioning you will trigger an AFK response.' },
                { name: '!lock [channel]', value: 'Locks a channel to prevent sending messages (requires Manage Channels permission; full whitelist only).' },
                { name: '!unlock [channel]', value: 'Unlocks a channel to allow sending messages (requires Manage Channels permission; full whitelist only).' },
                { name: '!slowmode <seconds> [channel]', value: 'Sets slowmode for a channel (0 to disable) (requires Manage Channels permission; full whitelist only).' },
                { name: '!roleadd <user> <role>', value: 'Adds a role to a user (requires Manage Roles permission; full whitelist only).' },
                { name: '!roleremove <user> <role>', value: 'Removes a role from a user (requires Manage Roles permission; full whitelist only).' },
                { name: '!announce <channel> <message>', value: 'Sends an announcement to a specified channel (requires Manage Messages permission; full whitelist only).' },
                { name: '!vpanel [channel]', value: 'Creates a verification panel with a button to grant the Member role (requires Manage Roles permission; full whitelist only).' },
                { name: '!poll <question> | <option1> | <option2> [| option3...]', value: 'Creates a poll with up to 10 options (accessible to all users).' },
                { name: '!trivia', value: 'Starts a trivia game with a random question (accessible to all users).' },
                { name: '!meme', value: 'Fetches a random meme from the internet (accessible to all users).' },
                { name: '!coinflip', value: 'Flips a virtual coin (heads or tails) (accessible to all users).' },
                { name: '!roll [dice]', value: 'Rolls dice (e.g., !roll 2d6 for two 6-sided dice) (accessible to all users).' },
                { name: '!rps <rock|paper|scissors>', value: 'Plays rock-paper-scissors with the bot (accessible to all users).' },
                { name: '!ping', value: 'Checks the bot\'s latency (accessible to all users).' },
                { name: '!avatar [user]', value: 'Displays a user\'s avatar (or your own if no user specified) (accessible to all users).' },
                { name: '!8ball <question>', value: 'Ask the magic 8-ball a question (accessible to all users).' },
                { name: 'Close Ticket Button', value: 'Inside each ticket channel, the ticket creator or users with Manage Channels permission can click the "Close Ticket" button to close the ticket (disables ability to send messages).' },
                { name: 'Delete Ticket Button', value: 'Inside each ticket channel, users with Manage Channels permission can click the "Delete Ticket" button to delete the ticket channel.' },
                { name: '!ticket closeall', value: 'Closes all tickets in the server by removing the ticket creators\' ability to send messages (requires Manage Channels permission; full whitelist only).' },
                { name: '!ticket close <channel>', value: 'Closes a specific ticket by removing the ticket creator\'s ability to send messages (requires Manage Channels permission; full whitelist only).' },
                { name: '!ticket open <channel>', value: 'Reopens a specific ticket by restoring the ticket creator\'s ability to send messages (requires Manage Channels permission; full whitelist only).' },
                { name: '!ticket delete <channel>', value: 'Deletes a specific ticket channel (requires Manage Channels permission; full whitelist only).' },
            ];

            const embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('Available Commands')
                .setDescription('Here is a list of all available commands (access depends on your whitelist status):')
                .setColor(0x00FF00)
                .setTimestamp();

            for (let i = 0; i < commands.length; i++) {
                if (currentEmbed.data.fields?.length >= 25 || i === commands.length - 1) {
                    embeds.push(currentEmbed);
                    currentEmbed = new EmbedBuilder()
                        .setTitle('Available Commands (Continued)')
                        .setDescription('More commands...')
                        .setColor(0x00FF00)
                        .setTimestamp();
                }
                currentEmbed.addFields([{ name: commands[i].name, value: commands[i].value, inline: false }]);
            }

            await message.reply({ embeds: embeds });
            await sendLogEmbed(guild, 'Command List Requested', `${user.tag} requested the command list.`, [
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'afk') {
            const reason = args.join(' ') || 'No reason provided';
            afkData[user.id] = { reason, timestamp: Date.now() };
            saveAfkData();
            await message.reply(`You are now AFK: ${reason}`);
            await sendLogEmbed(guild, 'AFK Set', `${user.tag} set their AFK status.`, [
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Reason', value: reason, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'purge') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return message.reply('You do not have permission to manage messages!');
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('Please provide a valid number between 1 and 100!');
            }

            try {
                const deleted = await channel.bulkDelete(amount, true);
                await message.reply(`Successfully deleted ${deleted.size} messages.`);
                await sendLogEmbed(guild, 'Messages Purged', `${user.tag} purged ${deleted.size} messages in ${channel.name}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
                    { name: 'Messages Deleted', value: deleted.size.toString(), inline: true },
                ], 0xFF0000);
            } catch (error) {
                console.error('Error purging messages:', error);
                await message.reply('There was an error purging messages.');
            }
            return;
        }

        if (command === 'userinfo') {
            const targetUser = args.length > 0 ? message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null) : user;
            if (!targetUser) {
                return message.reply('Please mention a valid user or provide a user ID!');
            }

            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle('User Information')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Username', value: targetUser.tag, inline: true },
                    { name: 'User ID', value: targetUser.id, inline: true },
                    { name: 'Account Created', value: targetUser.createdAt.toDateString(), inline: true },
                    ...(targetMember ? [
                        { name: 'Joined Server', value: targetMember.joinedAt.toDateString(), inline: true },
                        { name: 'Roles', value: targetMember.roles.cache.map(r => r.name).join(', ') || 'None', inline: false },
                    ] : []),
                ])
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            await sendLogEmbed(guild, 'User Info Requested', `${user.tag} requested info for ${targetUser.tag}.`, [
                { name: 'Requested By', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setTitle('Server Information')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Server Name', value: guild.name, inline: true },
                    { name: 'Server ID', value: guild.id, inline: true },
                    { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: 'Created On', value: guild.createdAt.toDateString(), inline: true },
                    { name: 'Member Count', value: guild.memberCount.toString(), inline: true },
                    { name: 'Channel Count', value: guild.channels.cache.size.toString(), inline: true },
                    { name: 'Role Count', value: guild.roles.cache.size.toString(), inline: true },
                ])
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            await sendLogEmbed(guild, 'Server Info Requested', `${user.tag} requested server information.`, [
                { name: 'Requested By', value: `${user.tag} (${user.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'lock') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('You do not have permission to manage channels!');
            }

            const targetChannel = args.length > 0 ? message.mentions.channels.first() : channel;
            if (!targetChannel) {
                return message.reply('Please mention a valid channel or use in the target channel!');
            }

            try {
                await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false,
                });
                await message.reply(`Channel ${targetChannel} has been locked.`);
                await sendLogEmbed(guild, 'Channel Locked', `${user.tag} locked ${targetChannel.name}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                ], 0xFF0000);
            } catch (error) {
                console.error('Error locking channel:', error);
                await message.reply('There was an error locking the channel.');
            }
            return;
        }

        if (command === 'unlock') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('You do not have permission to manage channels!');
            }

            const targetChannel = args.length > 0 ? message.mentions.channels.first() : channel;
            if (!targetChannel) {
                return message.reply('Please mention a valid channel or use in the target channel!');
            }

            try {
                await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: null,
                });
                await message.reply(`Channel ${targetChannel} has been unlocked.`);
                await sendLogEmbed(guild, 'Channel Unlocked', `${user.tag} unlocked ${targetChannel.name}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error unlocking channel:', error);
                await message.reply('There was an error unlocking the channel.');
            }
            return;
        }

        if (command === 'slowmode') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('You do not have permission to manage channels!');
            }

            const seconds = parseInt(args[0]);
            const targetChannel = args.length > 1 ? message.mentions.channels.first() : channel;
            if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
                return message.reply('Please provide a valid number of seconds (0-21600)!');
            }
            if (!targetChannel) {
                return message.reply('Please mention a valid channel or use in the target channel!');
            }

            try {
                await targetChannel.setRateLimitPerUser(seconds);
                const reply = seconds === 0 ? `Slowmode disabled in ${targetChannel}.` : `Slowmode set to ${seconds} seconds in ${targetChannel}.`;
                await message.reply(reply);
                await sendLogEmbed(guild, 'Slowmode Set', `${user.tag} set slowmode in ${targetChannel.name}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                    { name: 'Slowmode', value: `${seconds} seconds`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error setting slowmode:', error);
                await message.reply('There was an error setting slowmode.');
            }
            return;
        }

        if (command === 'roleadd') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return message.reply('You do not have permission to manage roles!');
            }

            const targetUser = message.mentions.members.first();
            const role = message.mentions.roles.first() || guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
            if (!targetUser || !role) {
                return message.reply('Please mention a user and a role!\nExample: !roleadd @user @role');
            }

            try {
                await targetUser.roles.add(role);
                await message.reply(`Added ${role.name} to ${targetUser.user.tag}.`);
                await sendLogEmbed(guild, 'Role Added', `${user.tag} added ${role.name} to ${targetUser.user.tag}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'User', value: `${targetUser.user.tag} (${targetUser.id})`, inline: true },
                    { name: 'Role', value: `${role.name} (${role.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error adding role:', error);
                await message.reply('There was an error adding the role.');
            }
            return;
        }

        if (command === 'roleremove') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return message.reply('You do not have permission to manage roles!');
            }

            const targetUser = message.mentions.members.first();
            const role = message.mentions.roles.first() || guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
            if (!targetUser || !role) {
                return message.reply('Please mention a user and a role!\nExample: !roleremove @user @role');
            }

            try {
                await targetUser.roles.remove(role);
                await message.reply(`Removed ${role.name} from ${targetUser.user.tag}.`);
                await sendLogEmbed(guild, 'Role Removed', `${user.tag} removed ${role.name} from ${targetUser.user.tag}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'User', value: `${targetUser.user.tag} (${targetUser.id})`, inline: true },
                    { name: 'Role', value: `${role.name} (${role.id})`, inline: true },
                ], 0xFF0000);
            } catch (error) {
                console.error('Error removing role:', error);
                await message.reply('There was an error removing the role.');
            }
            return;
        }

        if (command === 'announce') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return message.reply('You do not have permission to manage messages!');
            }

            const targetChannel = message.mentions.channels.first();
            const announcement = args.slice(1).join(' ');
            if (!targetChannel || !announcement) {
                return message.reply('Please mention a channel and provide a message!\nExample: !announce #channel Hello everyone!');
            }

            try {
                const embed = new EmbedBuilder()
                    .setTitle('Announcement')
                    .setDescription(announcement)
                    .setColor(0xFF4500)
                    .setTimestamp();
                await targetChannel.send({ embeds: [embed] });
                await message.reply(`Announcement sent to ${targetChannel}.`);
                await sendLogEmbed(guild, 'Announcement Sent', `${user.tag} sent an announcement to ${targetChannel.name}.`, [
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                    { name: 'Message', value: announcement, inline: false },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error sending announcement:', error);
                await message.reply('There was an error sending the announcement.');
            }
            return;
        }

        if (command === 'vpanel') {
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return message.reply('I do not have permission to manage roles! Please ensure I have the Manage Roles permission.');
            }

            const targetChannel = args.length > 0 ? message.mentions.channels.first() : channel;
            if (!targetChannel) {
                return message.reply('Please mention a valid channel or use in the target channel!\nExample: !vpanel #channel');
            }

            const embed = new EmbedBuilder()
                .setTitle('Verification Panel')
                .setDescription('Click the button below to verify and receive the Member role.')
                .setColor(0x00FF00)
                .setTimestamp();

            const button = new ButtonBuilder()
                .setCustomId(VERIFY_BUTTON_ID)
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(button);

            try {
                await targetChannel.send({ embeds: [embed], components: [row] });
                await message.reply(`Verification panel created in ${targetChannel}.`);
                await sendLogEmbed(guild, 'Verification Panel Created', `A verification panel was created in ${targetChannel.name}.`, [
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error creating verification panel:', error);
                await message.reply('There was an error creating the verification panel.');
            }
            return;
        }

        if (command === 'poll') {
            if (!args.length) {
                return message.reply('Usage: !poll <question> | <option1> | <option2> [| option3...]\nExample: !poll Favorite color? | Red | Blue | Green');
            }

            const parts = message.content.slice(PREFIX.length + command.length).trim().split('|').map(p => p.trim());
            if (parts.length < 3) {
                return message.reply('You must provide a question and at least two options!\nExample: !poll Favorite color? | Red | Blue');
            }

            const question = parts[0];
            const options = parts.slice(1).slice(0, 10);
            if (options.length > 10) {
                return message.reply('Polls can have a maximum of 10 options!');
            }

            const embed = new EmbedBuilder()
                .setTitle('📊 Poll: ' + question)
                .setDescription(options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'))
                .setColor(0x00FF00)
                .setFooter({ text: `Poll by ${user.tag}` })
                .setTimestamp();

            const pollMessage = await message.reply({ embeds: [embed] });
            for (let i = 0; i < options.length; i++) {
                await pollMessage.react(`${i + 1}️⃣`);
            }

            await sendLogEmbed(guild, 'Poll Created', `${user.tag} created a poll.`, [
                { name: 'Question', value: question, inline: true },
                { name: 'Options', value: options.length.toString(), inline: true },
                { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'trivia') {
            try {
                const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
                const data = await response.json();
                const question = data.results[0];

                const answers = [...question.incorrect_answers, question.correct_answer].sort(() => Math.random() - 0.5);
                const embed = new EmbedBuilder()
                    .setTitle('Trivia Time! 🧠')
                    .setDescription(`**Category:** ${question.category}\n**Question:** ${question.question}\n\n${answers.map((ans, i) => `**${i + 1}.** ${ans}`).join('\n')}`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Select an answer using the dropdown menu!' });

                const options = answers.map((ans, i) => new SelectMenuOptionBuilder()
                    .setLabel(ans)
                    .setValue(`trivia_${i}_${question.correct_answer}`)
                );

                const selectMenu = new SelectMenuBuilder()
                    .setCustomId('trivia_answer')
                    .setPlaceholder('Choose an answer...')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await message.reply({ embeds: [embed], components: [row] });
                await sendLogEmbed(guild, 'Trivia Started', `${user.tag} started a trivia game.`, [
                    { name: 'Category', value: question.category, inline: true },
                    { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error fetching trivia:', error);
                await message.reply('Could not fetch a trivia question. Please try again later.');
            }
            return;
        }

        if (command === 'meme') {
            try {
                const response = await fetch('https://www.reddit.com/r/memes/random/.json');
                const data = await response.json();
                const meme = data[0].data.children[0].data;

                if (!meme.url) {
                    return message.reply('Could not fetch a meme. Please try again!');
                }

                const embed = new EmbedBuilder()
                    .setTitle(meme.title)
                    .setImage(meme.url)
                    .setColor(0x00FF00)
                    .setFooter({ text: `Source: r/memes | 👍 ${meme.ups}` })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });
                await sendLogEmbed(guild, 'Meme Fetched', `${user.tag} fetched a meme.`, [
                    { name: 'Title', value: meme.title, inline: true },
                    { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error fetching meme:', error);
                await message.reply('Could not fetch a meme. Please try again later.');
            }
            return;
        }

        if (command === 'coinflip') {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            const embed = new EmbedBuilder()
                .setTitle('Coin Flip 🪙')
                .setDescription(`The coin landed on **${result}**!`)
                .setColor(0x00FF00)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            await sendLogEmbed(guild, 'Coin Flip', `${user.tag} flipped a coin.`, [
                { name: 'Result', value: result, inline: true },
                { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'roll') {
            let dice = args[0] || '1d6';
            const match = dice.match(/^(\d+)d(\d+)$/);
            if (!match) {
                return message.reply('Invalid dice format! Use NdM (e.g., !roll 2d6 for two 6-sided dice).');
            }

            const numDice = parseInt(match[1]);
            const sides = parseInt(match[2]);
            if (numDice < 1 || numDice > 100 || sides < 1 || sides > 1000) {
                return message.reply('Please use 1-100 dice with 1-1000 sides!');
            }

            const results = Array.from({ length: numDice }, () => Math.floor(Math.random() * sides) + 1);
            const total = results.reduce((sum, val) => sum + val, 0);

            const embed = new EmbedBuilder()
                .setTitle('Dice Roll 🎲')
                .setDescription(`Rolled **${dice}**:\nResults: ${results.join(', ')}\nTotal: **${total}**`)
                .setColor(0x00FF00)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            await sendLogEmbed(guild, 'Dice Roll', `${user.tag} rolled dice.`, [
                { name: 'Dice', value: dice, inline: true },
                { name: 'Total', value: total.toString(), inline: true },
                { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'rps') {
            const choice = args[0]?.toLowerCase();
            if (!['rock', 'paper', 'scissors'].includes(choice)) {
                return message.reply('Please choose rock, paper, or scissors!\nExample: !rps rock');
            }

            const botChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
            let result;

            if (choice === botChoice) {
                result = 'It\'s a tie!';
            } else if (
                (choice === 'rock' && botChoice === 'scissors') ||
                (choice === 'paper' && botChoice === 'rock') ||
                (choice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'You win!';
            } else {
                result = 'I win!';
            }

            const embed = new EmbedBuilder()
                .setTitle('Rock Paper Scissors ✊✋✌')
                .setDescription(`You chose **${choice}**.\nI chose **${botChoice}**.\n**${result}**`)
                .setColor(0x00FF00)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            await sendLogEmbed(guild, 'RPS Game', `${user.tag} played rock-paper-scissors.`, [
                { name: 'User Choice', value: choice, inline: true },
                { name: 'Bot Choice', value: botChoice, inline: true },
                { name: 'Result', value: result, inline: true },
            ], 0x00FF00);
            return;
        }

        if (command === 'ping') {
            const latency = Date.now() - message.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);
            const embed = new EmbedBuilder()
                .setTitle('Pong! 🏓')
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Message Latency', value: `${latency}ms`, inline: true },
                    { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
                ])
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }

        if (command === 'avatar') {
            const targetUser = args.length > 0 ? message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null) : user;
            if (!targetUser) {
                return message.reply('Please mention a valid user or provide a user ID!');
            }

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.tag}'s Avatar`)
                .setImage(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .setColor(0x00FF00)
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }

        if (command === '8ball') {
            if (!args.length) {
                return message.reply('Please ask a question!\nExample: !8ball Will it rain today?');
            }

            const responses = [
                'It is certain.',
                'Without a doubt.',
                'Yes, definitely.',
                'You may rely on it.',
                'As I see it, yes.',
                'Most likely.',
                'Outlook good.',
                'Yes.',
                'Signs point to yes.',
                'Reply hazy, try again.',
                'Ask again later.',
                'Better not tell you now.',
                'Cannot predict now.',
                'Concentrate and ask again.',
                'Don\'t count on it.',
                'My reply is no.',
                'My sources say no.',
                'Outlook not so good.',
                'Very doubtful.',
            ];
            const response = responses[Math.floor(Math.random() * responses.length)];
            const embed = new EmbedBuilder()
                .setTitle('Magic 8-Ball 🎱')
                .setDescription(`**Question:** ${args.join(' ')}\n**Answer:** ${response}`)
                .setColor(0x00FF00)
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }

        if (command === 'ticket') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('You do not have permission to manage tickets! (Requires Manage Channels permission)');
            }

            if (args.length < 1) {
                return message.reply('Usage: !ticket <closeall | close | open | delete> [channel]\nExample: !ticket close #ticket-channel');
            }

            const subcommand = args[0].toLowerCase();

            if (subcommand === 'closeall') {
                try {
                    const ticketChannels = guild.channels.cache.filter(ch => ch.name.startsWith('ticket-'));
                    if (ticketChannels.size === 0) {
                        return message.reply('No ticket channels found to close.');
                    }

                    for (const channel of ticketChannels.values()) {
                        const ticketCreatorId = channel.permissionOverwrites.cache
                            .filter(perm => perm.type === 1 && perm.allow.has(PermissionsBitField.Flags.ViewChannel))
                            .first()?.id;

                        if (ticketCreatorId) {
                            await channel.permissionOverwrites.edit(ticketCreatorId, {
                                SendMessages: false,
                            });
                        }
                    }

                    await message.reply('All ticket channels have been closed.');
                    await sendLogEmbed(guild, 'All Tickets Closed', `${user.tag} closed all ticket channels.`, [
                        { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Channels Affected', value: ticketChannels.size.toString(), inline: true },
                    ], 0xFF0000);
                } catch (error) {
                    console.error('Error closing all tickets:', error);
                    await message.reply('There was an error closing all tickets.');
                }
                return;
            }

            if (args.length < 2) {
                return message.reply(`Usage: !ticket ${subcommand} <channel>\nExample: !ticket ${subcommand} #ticket-channel`);
            }

            const channelMention = message.mentions.channels.first();
            if (!channelMention || !channelMention.name.startsWith('ticket-')) {
                return message.reply('Please mention a valid ticket channel! Ticket channels start with "ticket-".');
            }

            try {
                const ticketCreatorId = channelMention.permissionOverwrites.cache
                    .filter(perm => perm.type === 1 && perm.allow.has(PermissionsBitField.Flags.ViewChannel))
                    .first()?.id;

                if (!ticketCreatorId) {
                    return message.reply('Could not determine the ticket creator for this channel.');
                }

                if (subcommand === 'close') {
                    await channelMention.permissionOverwrites.edit(ticketCreatorId, {
                        SendMessages: false,
                    });
                    await message.reply(`Ticket channel ${channelMention} has been closed.`);
                    await channelMention.send('This ticket has been closed by a moderator. You can no longer send messages here.');
                    await sendLogEmbed(guild, 'Ticket Closed', `Ticket channel ${channelMention.name} was closed.`, [
                        { name: 'Channel', value: `${channelMention.name} (${channelMention.id})`, inline: true },
                        { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Ticket Creator', value: `<@${ticketCreatorId}> (${ticketCreatorId})`, inline: true },
                    ], 0xFF0000);
                } else if (subcommand === 'open') {
                    await channelMention.permissionOverwrites.edit(ticketCreatorId, {
                        SendMessages: true,
                    });
                    await message.reply(`Ticket channel ${channelMention} has been reopened.`);
                    await channelMention.send('This ticket has been reopened by a moderator. You can now send messages again.');
                    await sendLogEmbed(guild, 'Ticket Reopened', `Ticket channel ${channelMention.name} was reopened.`, [
                        { name: 'Channel', value: `${channelMention.name} (${channelMention.id})`, inline: true },
                        { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Ticket Creator', value: `<@${ticketCreatorId}> (${ticketCreatorId})`, inline: true },
                    ], 0x00FF00);
                } else if (subcommand === 'delete') {
                    const channelName = channelMention.name;
                    const channelId = channelMention.id;
                    await channelMention.delete();
                    await message.reply(`Ticket channel ${channelName} has been deleted.`);
                    await sendLogEmbed(guild, 'Ticket Deleted', `Ticket channel ${channelName} was deleted.`, [
                        { name: 'Channel', value: `${channelName} (${channelId})`, inline: true },
                        { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Ticket Creator', value: `<@${ticketCreatorId}> (${ticketCreatorId})`, inline: true },
                    ], 0xFF0000);
                } else {
                    await message.reply('Invalid subcommand! Use: closeall, close, open, or delete.\nExample: !ticket close #ticket-channel');
                }
            } catch (error) {
                console.error(`Error performing ticket ${subcommand}:`, error);
                await message.reply(`There was an error performing the ${subcommand} action on ${channelMention}.`);
            }
            return;
        }

        if (command === 'kick') {
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return message.reply('You do not have permission to kick members!');
            }

            if (args.length < 1) {
                return message.reply('Usage: !kick <user> [reason]\nExample: !kick @user Being disruptive');
            }

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply('Please mention a user to kick!');
            if (!targetUser.kickable) return message.reply('I cannot kick this user!');

            const reason = args.slice(1).join(' ') || 'No reason provided';

            try {
                await targetUser.kick(reason);
                await message.reply(`${targetUser.user.tag} has been kicked. Reason: ${reason}`);
                await sendLogEmbed(guild, 'Member Kicked', `${targetUser.user.tag} was kicked from the server.`, [
                    { name: 'User', value: `${targetUser.user.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Reason', value: reason },
                ], 0xFF0000);
            } catch (error) {
                console.error('Error kicking user:', error);
                await message.reply('There was an error kicking the user.');
            }
            return;
        }

        if (command === 'ban') {
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return message.reply('You do not have permission to ban members!');
            }

            if (args.length < 1) {
                return message.reply('Usage: !ban <user> [reason]\nExample: !ban @user Breaking rules');
            }

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply('Please mention a user to ban!');
            if (!targetUser.bannable) return message.reply('I cannot ban this user!');

            const reason = args.slice(1).join(' ') || 'No reason provided';

            try {
                await targetUser.ban({ reason });
                await message.reply(`${targetUser.user.tag} has been banned. Reason: ${reason}`);
                await sendLogEmbed(guild, 'Member Banned', `${targetUser.user.tag} was banned from the server.`, [
                    { name: 'User', value: `${targetUser.user.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Reason', value: reason },
                ], 0xFF0000);
            } catch (error) {
                console.error('Error banning user:', error);
                await message.reply('There was an error banning the user.');
            }
            return;
        }

        if (command === 'timeout') {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return message.reply('You do not have permission to timeout members!');
            }

            if (args.length < 2) {
                return message.reply('Usage: !timeout <user> <duration> [reason]\nExample: !timeout @user 10 Being disruptive');
            }

            const targetUser = message.mentions.members.first();
            const duration = parseInt(args[1]);
            const reason = args.slice(2).join(' ') || 'No reason provided';

            if (!targetUser) return message.reply('Please mention a user to timeout!');
            if (!targetUser.moderatable) return message.reply('I cannot timeout this user!');
            if (isNaN(duration) || duration <= 0) return message.reply('Please provide a valid duration in minutes!');

            try {
                await targetUser.timeout(duration * 60 * 1000, reason);
                await message.reply(`${targetUser.user.tag} has been timed out for ${duration} minutes. Reason: ${reason}`);
                await sendLogEmbed(guild, 'Member Timed Out', `${targetUser.user.tag} was timed out.`, [
                    { name: 'User', value: `${targetUser.user.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Reason', value: reason },
                ], 0xFFA500);
            } catch (error) {
                console.error('Error timing out user:', error);
                await message.reply('There was an error timing out the user.');
            }
            return;
        }

        if (command === 'ticketpanel') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('You do not have permission to create a ticket panel!');
            }

            const targetChannel = args.length > 0 ? message.mentions.channels.first() : channel;
            if (!targetChannel) {
                return message.reply('Please mention a valid channel or use in the target channel!\nExample: !ticketpanel #channel');
            }

            const embed = new EmbedBuilder()
                .setTitle('Support Tickets')
                .setDescription('Click the button below to create a support ticket.')
                .setColor(0x00FF00)
                .setImage('https://pixeldrain.com/api/file/9ByTWdho');

            const button = new ButtonBuilder()
                .setCustomId(TICKET_BUTTON_ID)
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            try {
                await targetChannel.send({ embeds: [embed], components: [row] });
                await message.reply(`Ticket panel created in ${targetChannel}.`);
                await sendLogEmbed(guild, 'Ticket Panel Created', `A ticket panel was created in ${targetChannel}.`, [
                    { name: 'Channel', value: `${targetChannel.name} (${targetChannel.id})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error creating ticket panel:', error);
                await message.reply('There was an error creating the ticket panel.');
            }
            return;
        }

        if (command === 'status') {
            if (args.length < 2) {
                return message.reply('Usage: !status <system> <status>\nExample: !status windows up\nSystems: windows, macos, linux, android, ios, scripthub\nStatuses: up, down, api, big, longtime, comingsoon');
            }

            const system = args[0].toLowerCase();
            const status = args[1].toLowerCase();

            if (!systems[system]) {
                return message.reply('Invalid system! Available systems: windows, macos, linux, android, ios, scripthub');
            }

            if (!statusMap[status]) {
                return message.reply('Invalid status! Available statuses: up, down, api, big, longtime, comingsoon');
            }

            const targetChannel = guild.channels.cache.get(channelIds[system]);
            if (!targetChannel) {
                return message.reply(`Channel for ${system} not found!`);
            }

            let currentName = targetChannel.name;
            const newStatusEmoji = statusMap[status].emoji;
            const newName = currentName.replace(/🟢|🔴|🔵|🟡|⚫|🟠/, newStatusEmoji);

            try {
                await targetChannel.setName(newName);
                await message.reply(`${systems[system]} status updated to ${status} (${statusMap[status].description}).`);
                await sendLogEmbed(guild, 'Status Updated', `${systems[system]} status was updated.`, [
                    { name: 'System', value: systems[system], inline: true },
                    { name: 'Status', value: `${status} (${statusMap[status].description})`, inline: true },
                    { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
                ], 0x00FF00);
            } catch (error) {
                console.error('Error updating status:', error);
                await message.reply('There was an error updating the channel name. Make sure I have the right permissions!');
            }
            return;
        }

if (command === 'downloads') {
    if (args.length < 2) {
        return message.reply('Usage: !downloads <target> <action> [link]\nExample: !downloads windows update https://newlink.com\nTargets: all, windows, macos, linux, android, ios, scripthub\nAction: update');
    }

    const target = args[0].toLowerCase();
    const action = args[1].toLowerCase();
    const newLink = args.slice(2).join(' ') || null;

    if (target !== 'all' && !systems[target]) {
        return message.reply('Invalid system! Available systems: windows, macos, linux, android, ios, scripthub, or use "all"');
    }

    if (action !== 'update') {
        return message.reply('Invalid action! Available action: update');
    }

    let finalLink = newLink;
    let linkMessage = '';
    if (newLink && newLink !== 'update') {
        if (!newLink.match(/^https?:\/\//)) {
            finalLink = `https://${newLink}`;
            linkMessage = ` (Added https:// to make it an absolute URL: ${finalLink})`;
        }
    }

    try {
        const repoOwner = 'Cracker64bit';
        const repoName = 'Blaze-Frontend';
        const filePath = 'script.js';

        const { data: fileData } = await octokit.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: filePath,
        });

        let jsContent = Buffer.from(fileData.content, 'base64').toString('utf8');

        const downloadUrlsRegex = /const downloadUrls = \{([^}]*)\}/;
        const match = jsContent.match(downloadUrlsRegex);
        if (!match) {
            return message.reply('Could not parse the downloadUrls object in script.js!');
        }

        let downloadUrlsContent = match[1];
        let updated = false;

        const platformsToUpdate = target === 'all' ? Object.keys(systems) : [target];

        for (const platform of platformsToUpdate) {
            const platformKey = platform === 'scripthub' ? 'scriptHub' : platform;
            const platformRegex = new RegExp(`${platformKey}:\\s*['"]([^'"]+)['"]`, 'g');
            if (newLink) {
                if (newLink === 'update') {
                    downloadUrlsContent = downloadUrlsContent.replace(platformRegex, `${platformKey}: 'update'`);
                } else {
                    downloadUrlsContent = downloadUrlsContent.replace(platformRegex, `${platformKey}: '${finalLink}'`);
                }
                updated = true;
            } else {
                downloadUrlsContent = downloadUrlsContent.replace(platformRegex, `${platformKey}: 'update'`);
                updated = true;
            }
        }

        if (!updated) {
            return message.reply(`Could not find the download link for the specified platform(s)!`);
        }

        const updatedJsContent = jsContent.replace(downloadUrlsRegex, `const downloadUrls = {${downloadUrlsContent}}`);

        const commitMessage = newLink
            ? `Update download link for ${target === 'all' ? 'all platforms' : systems[target]} to ${newLink === 'update' ? 'update' : finalLink}`
            : `Set download link for ${target === 'all' ? 'all platforms' : systems[target]} to "update"`;

        await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(updatedJsContent).toString('base64'),
            sha: fileData.sha,
            branch: 'main',
        });

        const replyMessage = newLink
            ? `Download link for ${target === 'all' ? 'all platforms' : 'Vortex ' + systems[target]} updated to "${newLink === 'update' ? 'update' : finalLink}".${linkMessage}`
            : `Download link for ${target === 'all' ? 'all platforms' : 'Vortex ' + systems[target]} set to "update".`;
        await message.reply(replyMessage);
        await sendLogEmbed(guild, 'Download Link Updated', `Download link for ${target === 'all' ? 'all platforms' : 'Vortex ' + systems[target]} was updated.`, [
            { name: 'System', value: target === 'all' ? 'All Platforms' : systems[target], inline: true },
            { name: 'Link', value: newLink ? (newLink === 'update' ? 'update' : finalLink) : 'update', inline: true },
            { name: 'Moderator', value: `${user.tag} (${user.id})`, inline: true },
        ], 0x00FF00);
    } catch (error) {
        console.error('Error updating downloads:', error);
        await message.reply('There was an error updating the website on GitHub. Check the bot logs for details.');
    }
    return;
}
    } catch (error) {
        console.error(`Error processing command ${command}:`, error);
        await message.reply('An error occurred while processing your command. Please try again later.');
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isSelectMenu()) return;

    try {
        if (interaction.isButton()) {
            if (interaction.customId === TICKET_BUTTON_ID) {
                await interaction.deferReply({ ephemeral: true });

                const user = interaction.user;
                const guild = interaction.guild;
                const panelChannel = interaction.channel;

                const category = panelChannel.parent;
                if (!category) {
                    return interaction.followUp({
                        content: 'The ticket panel channel must be in a category!',
                        ephemeral: true,
                    });
                }

                try {
                    const membersRole = guild.roles.cache.find(role => role.name === 'Members');

                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${user.username}-${user.discriminator}`,
                        type: 0,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            },
                            ...(membersRole ? [{
                                id: membersRole.id,
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            }] : []),
                            {
                                id: user.id,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                            },
                            {
                                id: client.user.id,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                            },
                            {
                                id: guild.roles.cache.find(role => role.name === 'Moderator')?.id || guild.roles.cache.find(role => role.permissions.has(PermissionsBitField.Flags.ManageChannels))?.id,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                            },
                        ],
                    });

                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('Support Ticket')
                        .setDescription(`Hello ${user}, welcome to your support ticket! Please describe your issue, and a moderator will assist you shortly.`)
                        .setColor(0x00FF00);

                    const controlEmbed = new EmbedBuilder()
                        .setTitle('Ticket Controls')
                        .setDescription('Click the buttons below to Blade your ticket.')
                        .setColor(0xFFA500);

                    const closeButton = new ButtonBuilder()
                        .setCustomId(CLOSE_TICKET_BUTTON_ID)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger);

                    const deleteButton = new ButtonBuilder()
                        .setCustomId(DELETE_TICKET_BUTTON_ID)
                        .setLabel('Delete Ticket')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder().addComponents(closeButton, deleteButton);

                    await ticketChannel.send({ content: `${user}`, embeds: [welcomeEmbed, controlEmbed], components: [row] });

                    await interaction.followUp({
                        content: `Your ticket has been created: ${ticketChannel}`,
                        ephemeral: true,
                    });

                    await sendLogEmbed(guild, 'Ticket Created', `A new ticket was created by ${user.tag}.`, [
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Ticket Channel', value: `${ticketChannel.name} (${ticketChannel.id})`, inline: true },
                    ], 0x00FF00);
                } catch (error) {
                    console.error('Error creating ticket:', error);
                    await interaction.followUp({
                        content: 'There was an error creating your ticket. Please try again later.',
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId === CLOSE_TICKET_BUTTON_ID) {
                await interaction.deferReply({ ephemeral: true });

                const user = interaction.user;
                const channel = interaction.channel;

                if (!channel.name.startsWith('ticket-')) {
                    return interaction.followUp({
                        content: 'This button can only be used in a ticket channel!',
                        ephemeral: true,
                    });
                }

                const ticketCreatorId = channel.permissionOverwrites.cache
                    .filter(perm => perm.type === 1 && perm.allow.has(PermissionsBitField.Flags.ViewChannel))
                    .first()?.id;

                if (!ticketCreatorId) {
                    return interaction.followUp({
                        content: 'Could not determine the ticket creator for this channel.',
                        ephemeral: true,
                    });
                }

                const member = await channel.guild.members.fetch(user.id);
                const canCloseTicket = user.id === ticketCreatorId || member.permissions.has(PermissionsBitField.Flags.ManageChannels);

                if (!canCloseTicket) {
                    return interaction.followUp({
                        content: 'Only the ticket creator or users with Manage Channels permission can close this ticket!',
                        ephemeral: true,
                    });
                }

                try {
                    await channel.permissionOverwrites.edit(ticketCreatorId, {
                        SendMessages: false,
                    });

                    await channel.send(`This ticket has been closed by ${user.tag}. Moderators can reopen it if needed.`);
                    await interaction.followUp({
                        content: 'Your ticket has been closed.',
                        ephemeral: true,
                    });

                    await sendLogEmbed(interaction.guild, 'Ticket Closed', `Ticket channel ${channel.name} was closed by ${user.tag}.`, [
                        { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
                        { name: 'Closed By', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Ticket Creator', value: `<@${ticketCreatorId}> (${ticketCreatorId})`, inline: true },
                    ], 0xFF0000);
                } catch (error) {
                    console.error('Error closing ticket:', error);
                    await interaction.followUp({
                        content: 'There was an error closing your ticket.',
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId === DELETE_TICKET_BUTTON_ID) {
                await interaction.deferReply({ ephemeral: true });

                const user = interaction.user;
                const channel = interaction.channel;

                if (!channel.name.startsWith('ticket-')) {
                    return interaction.followUp({
                        content: 'This button can only be used in a ticket channel!',
                        ephemeral: true,
                    });
                }

                const member = await channel.guild.members.fetch(user.id);

                if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                    return interaction.followUp({
                        content: 'You need Manage Channels permission to delete this ticket!',
                        ephemeral: true,
                    });
                }

                try {
                    const channelName = channel.name;
                    const channelId = channel.id;
                    const guild = interaction.guild;

                    await channel.delete();
                    await interaction.followUp({
                        content: 'The ticket has been deleted.',
                        ephemeral: true,
                    });

                    await sendLogEmbed(guild, 'Ticket Deleted', `Ticket channel ${channelName} was deleted by ${user.tag}.`, [
                        { name: 'Channel', value: `${channelName} (${channelId})`, inline: true },
                        { name: 'Deleted By', value: `${user.tag} (${user.id})`, inline: true },
                    ], 0xFF0000);
                } catch (error) {
                    console.error('Error deleting ticket channel:', error);
                    if (error.code !== 10003) { // Ignore "Unknown Channel" error
                        await interaction.followUp({
                            content: 'There was an error deleting the ticket. Please try again later.',
                            ephemeral: true,
                        });
                    }
                }
            }

            if (interaction.customId === VERIFY_BUTTON_ID) {
                await interaction.deferReply({ ephemeral: true });

                const user = interaction.user;
                const member = await interaction.guild.members.fetch(user.id);
                const memberRole = interaction.guild.roles.cache.find(role => role.name === 'Member');

                if (!memberRole) {
                    return interaction.followUp({
                        content: 'The "Member" role does not exist in this server!',
                        ephemeral: true,
                    });
                }

                if (member.roles.cache.has(memberRole.id)) {
                    return interaction.followUp({
                        content: 'You already have the Member role!',
                        ephemeral: true,
                    });
                }

                try {
                    await member.roles.add(memberRole);
                    await interaction.followUp({
                        content: 'You have been verified and received the Member role!',
                        ephemeral: true,
                    });
                    await sendLogEmbed(interaction.guild, 'Member Role Assigned', `${user.tag} was assigned the Member role via verification panel.`, [
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Role', value: `${memberRole.name} (${memberRole.id})`, inline: true },
                    ], 0x00FF00);
                } catch (error) {
                    console.error('Error assigning Member role:', error);
                    await interaction.followUp({
                        content: 'There was an error assigning the Member role. Please contact a moderator.',
                        ephemeral: true,
                    });
                }
            }
        }

        if (interaction.isSelectMenu() && interaction.customId === 'trivia_answer') {
            await interaction.deferReply({ ephemeral: true });

            const [_, index, correctAnswer] = interaction.values[0].split('_');
            const isCorrect = parseInt(index) === 0;

            const embed = new EmbedBuilder()
                .setTitle('Trivia Result')
                .setDescription(isCorrect ? `Correct! The answer was **${correctAnswer}**! 🎉` : `Incorrect. The correct answer was **${correctAnswer}**.`)
                .setColor(isCorrect ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            await interaction.followUp({ embeds: [embed], ephemeral: true });
            await interaction.message.edit({ components: [] }); // Disable the select menu
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: 'An error occurred while handling your interaction.', ephemeral: true }).catch(() => {});
        }
    }
});

client.on('guildMemberAdd', async (member) => {
    try {
        await sendLogEmbed(member.guild, 'Member Joined', `${member.user.tag} joined the server.`, [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'Joined At', value: member.joinedAt.toISOString(), inline: true },
        ], 0x00FF00);

        const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!welcomeChannel) return;

        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('New Member Alert! 🎉')
            .setDescription(`${randomMessage}\n\nHello ${member}, we're so happy you're here!`)
            .setColor(0xFF4500)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] });
    } catch (error) {
        console.error('Error handling guildMemberAdd:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        await sendLogEmbed(member.guild, 'Member Left', `${member.user.tag} left the server.`, [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'Roles', value: member.roles.cache.map(role => role.name).join(', ') || 'None', inline: true },
        ], 0xFF0000);
    } catch (error) {
        console.error('Error handling guildMemberRemove:', error);
    }
});

client.on('messageDelete', async (message) => {
    if (message.author.bot) return;
    try {
        await sendLogEmbed(message.guild, 'Message Deleted', `A message by ${message.author.tag} was deleted in ${message.channel}.`, [
            { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `${message.channel.name} (${message.channel.id})`, inline: true },
            { name: 'Content', value: message.content || 'No content available', inline: false },
        ], 0xFF0000);
    } catch (error) {
        console.error('Error handling messageDelete:', error);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.author.bot || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;
    try {
        await sendLogEmbed(oldMessage.guild, 'Message Edited', `A message by ${oldMessage.author.tag} was edited in ${oldMessage.channel}.`, [
            { name: 'Author', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
            { name: 'Channel', value: `${oldMessage.channel.name} (${oldMessage.channel.id})`, inline: true },
            { name: 'Old Content', value: oldMessage.content || 'No content available', inline: false },
            { name: 'New Content', value: newMessage.content || 'No content available', inline: false },
        ], 0xFFA500);
    } catch (error) {
        console.error('Error handling messageUpdate:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);