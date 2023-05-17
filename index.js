const axios = require('axios');
const countries = require('iso-3166-1-alpha-2');
const discord = require('discord.js');
const { EmbedBuilder, Client, Intents, Events, WebhookClient, MessageEmbed } = require('discord.js');
const fs = require('fs');

// Read the config file
const configFile = fs.readFileSync('config.json', 'utf8');

// Parse the JSON content
const config = JSON.parse(configFile);

const ADMIN = config.ADMIN;
const TOKEN = config.TOKEN;
let WEBHOOK_URLS = config.WEBHOOK_URLS;
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
  if (message.content.startsWith('!add_webhook') && message.author.id === ADMIN) {
    const args = message.content.split(' ');
    if (args.length === 3) {
      const webhookUrl = args[1];
      const region = args[2];
      addWebhookUrl(webhookUrl, region);
      const success_message = await message.channel.send(`Webhook URL has been added.`);
      await message.delete();

      // Create an embedded message
      let embed = new EmbedBuilder()
        .setTitle('Swift Raffles Setup')
        .setDescription(`Webhook has been configured and setup for ${region} region!`)
        .setColor('#00ff00')
        .setTimestamp();

      // Send the embedded message
      let webhookPayload = {
        embeds: [embed],
        username: 'Swift Raffles',
        avatar_url: 'https://cdn.discordapp.com/attachments/1088524740693606480/1105587682572251178/swift_mail.png',
      };

      await axios.post(webhookUrl, webhookPayload);

      setTimeout(async () => {
        await success_message.delete();
      }, 5000);
    } else {
      await message.channel.send('Invalid command usage. Please provide a webhook URL and a region.');
    }
  } else if (message.content.startsWith('!test') && message.author.id === ADMIN) {
    const args = message.content.split(' ');
    if (args.length === 2) {
      const region = args[1];
      await testFunction(message, region);
    }
  }
});

function addWebhookUrl(webhookUrl, region) {
  WEBHOOK_URLS[region].push(webhookUrl);
  updateConfig();
}

function updateConfig() {
  const updatedConfig = { ...config, WEBHOOK_URLS };
  fs.writeFileSync('config.json', JSON.stringify(updatedConfig, null, 2));
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
  const response = await axios.post(url, data, { headers });

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

async function sendEmbeddedMessage(productName, productRegion, productType, productStore, productOpen, productClose, productDeliveryMethod, productUrl, productStockX, productNotes, productImageUrl, productRetailerImageUrl, productpayment, regionWebhookUrls) {
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
    ])
    .setFooter({ text: 'Swift Raffles', iconURL: 'https://cdn.discordapp.com/attachments/1088524740693606480/1105587682572251178/swift_mail.png' })
    .setTimestamp(new Date());
  if (productpayment !== 'None') {
    embed.addFields({ name: 'PreAuth', value: productpayment, inline: true });
  }
  embed.addFields({name: 'Value:', value: `:chart_with_upwards_trend: [StockX](${productStockX})`, inline: true});

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
  for (const webhookUrl of regionWebhookUrls) {
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
        const validLocales = ['Europe', 'Denmark', 'France', 'Germany', 'Ireland', 'Italy', 'Netherlands', 'Poland', 'Spain', 'Switzerland', 'United Kingdom', 'United States', 'Worldwide'];
        if (validLocales.includes(product.locale)) {
          const productName = product.product.name;
          const productRegion = product.locale;
          const productType = product.type;
          const productStore = product.retailer.name;
          const productOpen = product.startDate
            ? `<t:${Date.parse(product.startDate) / 1000}>`
            : 'Now';
          const productClose = product.endDate
            ? `<t:${Date.parse(product.endDate) / 1000}>`
            : 'TBA';
          const productDeliveryMethod = product.hasPostage ? 'Shipping' : 'In Store Pickup';
          const productUrl = product.url;
          const productImageUrl = product.product.imageUrl;
          const productRetailerImageUrl = product.retailer.imageUrl;
          const productStockX = `https://stockx.com/${product.product.stockxSlug.replace(/\s+/g, '')}`;
          const productNotes = product.notes || 'None';
          const productpayment = product.retailer.preAuth ? ":credit_card:" : "None";
          console.log('passed challenge 1 in checkraffles.');
          let regionWebhookUrls;
          switch (product.locale) {
            case 'United States':
              regionWebhookUrls = WEBHOOK_URLS.US;
              break;
            case 'Denmark':
            case 'Europe':
            case 'France':
            case 'Germany':
            case 'Ireland':
            case 'Italy':
            case 'Netherlands':
            case 'Poland':
            case 'Spain':
            case 'Switzerland':
            case 'United Kingdom':
              regionWebhookUrls = WEBHOOK_URLS.EU;
              break;
            case 'Worldwide':
              regionWebhookUrls = WEBHOOK_URLS.WW;
              break;
            default:
              console.log('Invalid region');
              return;
          }
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
            productRetailerImageUrl,
            productpayment,
            regionWebhookUrls
          );
        }
      }
    }
    console.log("Raffles are being checked for updates");
  } catch (e) {
    console.log("Error occurred while checking raffles:", e);
  }

}
  
async function testFunction(message, region) {
  try {
    const products = await fetchRaffles();
    if (products) {
      const product_name = products[0].product.name;
      const product_region = products[0]["locale"];
      const product_type = products[0]["type"];
      const product_store = products[0]["retailer"]["name"];
      
      const product_open = products[0]['startDate']
            ? `<t:${Date.parse(products[0]['startDate']) / 1000}>`
            : 'Now';
      const product_close = products[0]['endDate']
        ? `<t:${Date.parse(products[0]['endDate']) / 1000}>`
        : 'TBA';
  
      const product_delivery_method = products[0]["hasPostage"]
        ? "Shipping"
        : "In Store Pickup";
      const product_url = products[0]["url"];
      const product_image_url = products[0]["product"]["imageUrl"];
      const product_retailer_image_url =
        products[0]["retailer"]["imageUrl"];
      const product_stockx = `https://stockx.com/${products[0]["product"]["stockxSlug"].replace(/\s+/g, '')}`;
      const product_notes =
        products[0]["notes"] && products[0]["notes"].length > 0
          ? products[0]["notes"]
          : "None";
      const productpayment = products[0]['retailer']['preAuth'] ? ":credit_card:" : "None";

      let regionWebhookUrls = WEBHOOK_URLS[region];
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
        product_retailer_image_url,
        productpayment,
        regionWebhookUrls
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