const axios = require('axios');
const countries = require('iso-3166-1-alpha-2');
const discord = require('discord.js');
const { EmbedBuilder, Client, Intents, Events } = require('discord.js');
const fs = require('fs');
const moment = require('moment')

// Read the config file
const configFile = fs.readFileSync('config.json', 'utf8');

// Parse the JSON content
const config = JSON.parse(configFile);

const ADMIN = config.ADMIN;
const TOKEN = config.TOKEN;
const WEBHOOK_URLS = config.WEBHOOK_URLS;
const APP_AUTH = config.APP_AUTH;
const APP_REFRESH = config.APP_REFRESH;

const client = new Client({
  intents: 3276799
});

const raffleIds = new Set();

async function initializeRaffleIds() {
  const initialRaffles = await fetchRaffles();
  for (const raffle of initialRaffles) {
    const raffleId = raffle.id;
    raffleIds.add(raffleId);
  }
}

client.on('error', (error) => {
  console.error('An error occurred:', error);
});

client.on('ready', async () => {
  console.log(`${client.user.username} has connected to Discord!`);
  await initializeRaffleIds();
  checkRaffles();
});

client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!add_webhook_mobile') && message.author.id === ADMIN) {
    const args = message.content.split(' ');
    if (args.length === 2) {
      const webhookUrl = args[1];
      addWebhookUrl(webhookUrl);
      const success_message = await message.channel.send(`Webhook URL has been added.`);
      await message.delete();
      setTimeout(async () => {
        await success_message.delete();
      }, 5000);
    } else {
      await message.channel.send('Invalid command usage. Please provide a single webhook URL.');
    }
  } else if (message.content === '!test_mobile' && message.author.id === ADMIN) {
    await testFunction(message);
  }
  // Rest of the code...
});

function addWebhookUrl(webhookUrl) {
  WEBHOOK_URLS.push(webhookUrl);
  updateConfig();
}

function updateConfig() {
  const updatedConfig = { ...config, WEBHOOK_URLS };
  fs.writeFileSync('config-beta.json', JSON.stringify(updatedConfig, null, 2));
}

async function fetchRaffles() {
  const headers = {
    'Content-Type': 'application/json',
    Pragma: 'no-cache',
    Accept: '*/*',
    'Cache-Control': 'no-cache',
    Host: 'sole-retriever-mobile.netlify.app',
    'User-Agent': 'SoleRetriever/1 CFNetwork/1406.0.4 Darwin/22.4.0',
    'x-supabase-auth': `${APP_AUTH}`,
    'x-supabase-refresh': `${APP_REFRESH}`,
  };

  const url = 'https://sole-retriever-mobile.netlify.app/.netlify/functions/getRecentRaffles';
  const data = {
    "limit": 16,
    "offset": 0
  }
  const response = await axios.post(url, { data }, { headers });

  try {
    if (response.status === 200) {
      const data = response.data;
      const products = data.data.data;
      return products;
    } else {
      console.log('Error fetching raffles:', response.statusText);
      return [];
    }
    } catch (e) {
        console.log('Error:', e);
        return [];
  }
}

async function sendEmbeddedMessage(productName, productRegion, productType, productStore, productOpen, productClose, productDeliveryMethod, productUrl, productStockX, productNotes, productImageUrl, productRetailerImageUrl) {
  const embed = new EmbedBuilder()
    .setTitle(productName)
    .setURL(productUrl)
    .setDescription(`A new raffle for ${productName} is live!`)
    .setColor(0x68CD89)
    .setThumbnail(productImageUrl)
    .addFields([
      { name: 'Region', value: `${getFlagEmoji(productRegion)} ${productRegion}`, inline: true },
      { name: 'Type', value: productType, inline: true },
      { name: 'Store', value: productStore, inline: true },
      { name: 'Open', value: productOpen, inline: true },
      { name: 'Close', value: productClose, inline: true },
      { name: 'Delivery', value: getDeliveryEmoji(productDeliveryMethod), inline: true },
      { name: 'Entry:', value: `[Enter at ${productStore}](${productUrl})`, inline: true },
      { name: 'Value:', value: `:chart_with_upwards_trend: [StockX](${productStockX})`, inline: true },
    ])
    .setFooter({ text: 'Swift Raffles', iconURL: 'https://cdn.discordapp.com/attachments/1088524740693606480/1105587682572251178/swift_mail.png' })
    .setTimestamp(new Date());

  if (productNotes.length > 23) {
    const notesValue = productNotes
      .replace(' | Assume random end time.', '')
      .replace(' | Heads Up', '')
      .replace('Heads up | ', '');

    embed.addFields({ name: 'Notes:', value: notesValue, inline: false });
  }

  const webhookPayload = {
    embeds: [embed],
    username: 'Swift Raffles',
    avatar_url: 'https://cdn.discordapp.com/attachments/1088524740693606480/1105587682572251178/swift_mail.png',
  };

  const tasks = [];
  for (const webhookUrl of WEBHOOK_URLS) {
    const task = sendWebhook(webhookUrl, webhookPayload);
    tasks.push(task);
  }
  await Promise.all(tasks);
}

async function sendWebhook(webhookUrl, webhookPayload) {
  try {
    const response = await axios.post(webhookUrl, webhookPayload);
  } catch (e) {
    console.log(`Error sending webhook to ${webhookUrl}: ${e}`);
  }
}

function getFlagEmoji(region) {
  const regionFlags = {
    Worldwide: ":globe_with_meridians:",
    Europe: ":flag_eu:",
  };

  if (region in regionFlags) {
    return regionFlags[region];
  }

  try {
    const country_code = countries.getCode(region);
    const flagEmoji = `:flag_${country_code.toLowerCase()}:`
    return flagEmoji;
  } catch (error) {
    return "";
  }
}
  
function getDeliveryEmoji(retrieval) {
  switch (retrieval) {
    case "Shipping":
      return ":package: " + retrieval;
    case "In Store Pickup":
      return ":door: " + retrieval;
    default:
      return ":white_check_mark: " + retrieval;
  }
}

async function checkRaffles() {
  try {
    const newRaffles = await fetchRaffles();
    for (const product of newRaffles) {
      const raffleId = product.id;
      if (!raffleIds.has(raffleId)) {
        raffleIds.add(raffleId);
        if (product.locale === 'United States' || product.locale === 'Worldwide') {
          const productName = product.product.name;
          const productRegion = product.locale;
          const productType = product.type;
          const productStore = product.retailer.name;
          const productOpen = product.startDate
            ? moment(product.startDate).utcOffset('-0400').format('MMMM DD, hh:mm A')
            : 'Now';
          const productClose = product.endDate
            ? moment(product.endDate).utcOffset('-0400').format('MMMM DD, hh:mm A')
            : 'TBA';
          const productDeliveryMethod = product.hasPostage ? 'Shipping' : 'In Store Pickup';
          const productUrl = product.url;
          const productImageUrl = product.product.imageUrl;
          const productRetailerImageUrl = product.retailer.imageUrl;
          const productStockX = `https://stockx.com/${product.product.stockxSlug}`;
          const productNotes = product.notes || 'None';

          await sendEmbeddedMessage(
            productName,
            productRegion,
            productType,
            productStore,
            productOpen,
            productClose,
            productDeliveryMethod,
            productUrl,
            productStockX,
            productNotes,
            productImageUrl,
            productRetailerImageUrl
          );
        }
      }
    }
    console.log("Raffles are being checked for updates");
  } catch (e) {
    console.log("Error occurred while checking raffles:", e);
  }

}
  
async function testFunction(message) {
  try {
    const products = await fetchRaffles();
    if (products) {
      const product_name = products[0].product.name;
      const product_region = products[0]["locale"];
      const product_type = products[0]["type"];
      const product_store = products[0]["retailer"]["name"];
  
      let product_open, product_close;
      if (!products[0]["startDate"]) {
        product_open = "Now";
      } else {
        const dt2 = new Date(products[0]["startDate"]);
        const pst_timestamp2 = new Date(dt2.getTime() - 4 * 60 * 60 * 1000);
        product_open = pst_timestamp2.toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
      }
  
      if (products[0]["endDate"]) {
        const dt = new Date(products[0]["endDate"]);
        const pst_timestamp = new Date(dt.getTime() - 4 * 60 * 60 * 1000);
        product_close = pst_timestamp.toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
      } else {
        product_close = "TBA";
      }
  
      const product_delivery_method = products[0]["hasPostage"]
        ? "Shipping"
        : "In Store Pickup";
      const product_url = products[0]["url"];
      const product_image_url = products[0]["product"]["imageUrl"];
      const product_retailer_image_url =
        products[0]["retailer"]["imageUrl"];
      const product_stockx = `https://stockx.com/${products[0]["product"]["stockxSlug"]}`;
      const product_notes =
        products[0]["notes"] && products[0]["notes"].length > 0
          ? products[0]["notes"]
          : "None";
  
      await sendEmbeddedMessage(
        product_name,
        product_region,
        product_type,
        product_store,
        product_open,
        product_close,
        product_delivery_method,
        product_url,
        product_stockx,
        product_notes,
        product_image_url,
        product_retailer_image_url
      );
      await message.delete();
      const success_message = await message.channel.send("Test webhook sent.");
      setTimeout(async () => {
        await success_message.delete();
      }, 5000);
    } else {
      await message.channel.send("Test failed.");
    }
  } catch (error) {
    // Handle request exception/error
    console.error("Test function error:", error);
  }
}

async function bot() {
  // Schedule periodic checks for new raffles
  await setInterval(checkRaffles, CHECK_INTERVAL);
}
  
  // Define the interval (in milliseconds) for checking new raffles
const CHECK_INTERVAL = 60000; // 1 minute

  
  // Start the bot
bot();

client.login(TOKEN);