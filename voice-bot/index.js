require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  Events,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Load environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const AFK_CHANNEL_ID = ""; // AFK voice channel
const STATUS = process.env.STATUS || "prod"; // prod or debug

// Track mute timers
const muteTimers = new Map();

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag} [Mode: ${STATUS}]`);
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Bot Online")
      .setDescription(`**${client.user.tag}** is now online and ready!`)
      .setTimestamp();
    logChannel.send({ embeds: [embed] });
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const logChannel = newState.guild.channels.cache.get(LOG_CHANNEL_ID);

  // ---- [1] Handle temp voice channel creation ----
  if (newState.channelId === CREATE_CHANNEL_ID) {
    const guild = newState.guild;
    const user = newState.member;

    try {
      const botMember = await guild.members.fetch(client.user.id);
      const category = newState.channel?.parent;

      // --- Debug: log perms ---
      if (STATUS === "debug" && category) {
        const perms = botMember.permissionsIn(category);
        console.log("🔎 Debug: Bot Permissions in Category:");
        console.log("ManageChannels:", perms.has(PermissionsBitField.Flags.ManageChannels));
        console.log("MoveMembers:", perms.has(PermissionsBitField.Flags.MoveMembers));
        console.log("Connect:", perms.has(PermissionsBitField.Flags.Connect));
        console.log("ViewChannel:", perms.has(PermissionsBitField.Flags.ViewChannel));
      }

      // --- Check perms before trying to create ---
      if (category) {
        const perms = botMember.permissionsIn(category);
        if (!perms.has(PermissionsBitField.Flags.ManageChannels)) {
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setColor("Orange")
              .setTitle("⚠️ Error")
              .setDescription(`Cannot create channel for <@${user.id}>`)
              .addFields({ name: "Details", value: "`Missing ManageChannels permission`" })
              .setTimestamp();
            logChannel.send({ embeds: [embed] });
          }
          return; // stop here, avoid false positive error
        }
      }

      const newChannel = await guild.channels.create({
        name: `${user.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel?.parentId ?? null,
        permissionOverwrites: [
          {
            id: guild.id, // everyone
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id, // room owner
            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.Connect],
          },
        ],
      });

      await user.voice.setChannel(newChannel);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("Blue")
          .setTitle("📢 Temporary Voice Channel Created")
          .setDescription(`Created **${newChannel.name}** for <@${user.id}>`)
          .setThumbnail(user.user.displayAvatarURL())
          .setTimestamp();
        logChannel.send({ embeds: [embed] });
      }

      const interval = setInterval(() => {
        if (newChannel.members.size === 0) {
          newChannel.delete().catch(() => {});
          clearInterval(interval);

          if (logChannel) {
            const embed = new EmbedBuilder()
              .setColor("Red")
              .setTitle("🗑️ Temporary Voice Channel Deleted")
              .setDescription(`Deleted empty channel **${newChannel.name}**`)
              .setTimestamp();
            logChannel.send({ embeds: [embed] });
          }
        }
      }, 5000);
    } catch (err) {
      // ✅ Ignore false-positive "Missing Permissions" errors (50013)
      if (err.code === 50013) {
        console.warn("⚠️ Ignored false Missing Permissions error (channel still created).");
        return;
      }

      console.error("Error creating channel:", err);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("Orange")
          .setTitle("⚠️ Error")
          .setDescription(`Unexpected error while creating channel for <@${newState.id}>`)
          .addFields({ name: "Details", value: `\`${err.message}\`` })
          .setTimestamp();
        logChannel.send({ embeds: [embed] });
      }
    }
  }

  // ---- [2] Handle AFK Auto-Move ----
  const member = newState.member;

  if (
    newState.channelId &&
    (newState.selfMute || newState.selfDeaf) &&
    newState.channelId !== AFK_CHANNEL_ID
  ) {
    if (!muteTimers.has(member.id)) {
      const timer = setTimeout(async () => {
        if (
          member.voice.channel &&
          (member.voice.selfMute || member.voice.selfDeaf) &&
          member.voice.channel.id !== AFK_CHANNEL_ID
        ) {
          try {
            await member.voice.setChannel(AFK_CHANNEL_ID);

            if (logChannel) {
              const embed = new EmbedBuilder()
                .setColor("Yellow")
                .setTitle("⏳ AFK Auto-Move")
                .setDescription(`<@${member.id}> was moved to AFK channel after 15 minutes muted.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
              logChannel.send({ embeds: [embed] });
            }
          } catch (err) {
            console.error("Error moving user to AFK:", err);
          }
        }
        muteTimers.delete(member.id);
      }, 15 * 60 * 1000);

      muteTimers.set(member.id, timer);
    }
  } else {
    if (muteTimers.has(member.id)) {
      clearTimeout(muteTimers.get(member.id));
      muteTimers.delete(member.id);
    }
  }
});

client.login(TOKEN);

