const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('@napi-rs/canvas');
const { request } = require('undici');
require('dotenv').config();

// Bot configuration
const config = {
    channelId: '', // Channel ID untuk logs welcome dan goodbye
    serverId: '',   // Server ID Discord
    welcomeMessage: 'semoga kamu betah di sini', // Kata Kata dibawah welcome
    goodbyeMessage: 'selamat tinggal {user} selamat kembali ke jalan yang benar!' // Kata kata dibawah Selamat Tinggal
};

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Guilds intents
        GatewayIntentBits.GuildMembers, // Members
        GatewayIntentBits.GuildMessages // Send messages
    ]
});

// Function to create beautiful welcome image
async function createWelcomeImage(member, isWelcome = true) {
    const canvas = Canvas.createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 800, 400);
    if (isWelcome) {
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(0.5, '#764ba2');
        gradient.addColorStop(1, '#f093fb');
    } else {
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#ee5a52');
        gradient.addColorStop(1, '#ff9a9e');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 400);

    // Add overlay pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 800; i += 40) {
        for (let j = 0; j < 400; j += 40) {
            if ((i + j) % 80 === 0) {
                ctx.fillRect(i, j, 20, 20);
            }
        }
    }

    // Draw decorative elements
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(700, 100, 60, 0, Math.PI * 2);
    ctx.arc(100, 300, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Load and draw user avatar
    try {
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const { body } = await request(avatarURL);
        const avatar = new Uint8Array(await body.arrayBuffer());
        const avatarImage = new Canvas.Image();
        avatarImage.src = avatar;

        // Wait for image to load
        await new Promise((resolve) => {
            avatarImage.onload = resolve;
        });

        // Create circular avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(400, 150, 80, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        ctx.drawImage(avatarImage, 320, 70, 160, 160);
        ctx.restore();

        // Add avatar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(400, 150, 80, 0, Math.PI * 2);
        ctx.stroke();

        // Add glow effect
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(400, 150, 85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

    } catch (error) {
        console.error('Failed to load avatar:', error);
        // Draw default avatar placeholder
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(400, 150, 80, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#666666';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('?', 400, 170);
    }

    // Draw main title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    
    if (isWelcome) {
        ctx.fillText('Welcome to Neraka Dunia!', 400, 280); // Welcome untuk dibanner
    } else {
        ctx.fillText('Goodbye from Neraka!', 400, 280); // Goodbye untuk dibanner
    }

    // Draw username
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#f8f9fa';
    const username = member.user.username;
    const displayName = username.length > 20 ? username.substring(0, 17) + '...' : username;
    ctx.fillText(displayName, 400, 320);

    // Add member count decoration
    const guild = member.guild;
    ctx.font = '18px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    if (isWelcome) {
        ctx.fillText(`Member #${guild.memberCount}`, 400, 350);
    } else {
        ctx.fillText(`${guild.memberCount} members remaining`, 400, 350);
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    return canvas.encode('png');
}

// Welcome event
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel) {
            console.error('Welcome channel not found!');
            return;
        }

        // Create beautiful welcome image
        const welcomeImage = await createWelcomeImage(member, true);
        const attachment = new AttachmentBuilder(welcomeImage, { name: 'welcome.png' });

        // Create embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Selamat Datang!') // Judul atau title diatas
            .setDescription(`Welcome to **Neraka Dunia**, ${member}!\n${config.welcomeMessage}`) // Deskripsi untuk template welcome
            .setColor('#667eea')
            .setImage('attachment://welcome.png')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 Username', value: member.user.username, inline: true },
                { name: '🆔 User ID', value: member.user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true },
                { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: '🕐 Joined Server', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '🌟 Status', value: 'New Member', inline: true }
            )
            .setFooter({ 
                text: `${member.guild.name} • Welcome System`, 
                iconURL: member.guild.iconURL() 
            })
            .setTimestamp();

        await channel.send({ 
            content: `🎊 ${member} has joined the server!`, 
            embeds: [welcomeEmbed], 
            files: [attachment] 
        });

    } catch (error) {
        console.error('Error in welcome event:', error);
    }
});

// Goodbye event
client.on('guildMemberRemove', async (member) => {
    try {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel) {
            console.error('Goodbye channel not found!');
            return;
        }

        // Create beautiful goodbye image
        const goodbyeImage = await createWelcomeImage(member, false);
        const attachment = new AttachmentBuilder(goodbyeImage, { name: 'goodbye.png' });

        // Create embed
        const goodbyeEmbed = new EmbedBuilder()
            .setTitle('👋 Selamat Tinggal!') // Title atau judul
            .setDescription(config.goodbyeMessage.replace('{user}', member.user.username))
            .setColor('#ff6b6b')
            .setImage('attachment://goodbye.png')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 Username', value: member.user.username, inline: true },
                { name: '🆔 User ID', value: member.user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true },
                { name: '👥 Members Left', value: `${member.guild.memberCount}`, inline: true },
                { name: '⏰ Left Server', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '📊 Status', value: 'Former Member', inline: true }
            )
            .setFooter({ 
                text: `${member.guild.name} • Goodbye System`, 
                iconURL: member.guild.iconURL() 
            })
            .setTimestamp();

        await channel.send({ 
            embeds: [goodbyeEmbed], 
            files: [attachment] 
        });

    } catch (error) {
        console.error('Error in goodbye event:', error);
    }
});

// Bot ready event
client.on('ready', () => {
    console.log(`🤖 ${client.user.tag} is now online!`);
    console.log(`📊 Monitoring ${client.guilds.cache.size} servers`);
    console.log(`👥 Watching ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} members`);
    console.log(`📢 Welcome/Goodbye channel: ${config.channelId}`);
    
    // Set bot status
    client.user.setPresence({
        activities: [{ name: 'for new members | Neraka Dunia', type: 3 }],
        status: 'online',
    });
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
