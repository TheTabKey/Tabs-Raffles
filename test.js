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
        const product_stockx = `https://stockx.com/${products[0]["product"]["stockxSlug"].replace(/\s+/g, '')}`;
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