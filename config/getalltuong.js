import { Card } from "../models/Card.js";
import axios from "axios";
import cheerio from "cheerio";
export const fetchChamptionById = async (championId) => {
  try {
    const response = await axios.get(
      `https://lienquan.garena.vn/tuong-chi-tiet/${championId}`
    );
    const html = response.data;

    const $ = cheerio.load(html);
    const name = $(".skin-hero .title").text();
    const skinElements = $("div.cont-skin div.tabs-content-skin img");
    const skinImages = [];

    skinElements.each((index, element) => {
      const imageUrl = "https://lienquan.garena.vn/" + $(element).attr("src");
      skinImages.push(imageUrl);
    });

    const skillElements = $("#tab-1 .col-skill .item-skill");
    const skills = [];

    skillElements.each((index, element) => {
      const description = $(element).find(".txt:nth-child(4)").text().trim();

      const skill = description;

      skills.push(skill);
    });
    const skinMain = skinImages[skinImages.length - 1];
    const skillUntil = skills[skills.length - 1];
    const jsonData = {
      name,
      skillUntil,
      skinMain,
    };
    return jsonData;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};
export const fetchAllChampion = async () => {
  try {
    const response = await axios.get("https://lienquan.garena.vn/tuong");
    const html = response.data;

    const $ = cheerio.load(html);
    const liElements = $("ul.listhero li");

    const champions = [];

    liElements.each((index, element) => {
      const championId = $(element).attr("id");
      const championName = $(element).find(".name").text();
      const championImageSrc =
        "https://lienquan.garena.vn/" + $(element).find("img").attr("src");
      const championLink = $(element).find("a").attr("href");

      champions.push({
        championId: championId,
        championName: championName,
        championImageSrc: championImageSrc,
        championLink: championLink,
      });
    });

    return champions;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

export const saveAllChampionsToDB = async () => {
  const champions = await fetchAllChampion();
  for (const champion of champions) {
    const id = champion.championId.replace("champion-", "");
    if (id === "75" || id==="108") {
      continue;
    }

    const championData = await fetchChamptionById(id);

    const existingCard = await Card.findOne({ name: championData.name });
    if (!existingCard) {
      await Card.create({
        name: championData.name,
        total: 100,
        price: 1000,
        stt:id,
        description: championData.skillUntil,
        image: {
          public_id: `champion_${champion.championId}`,
          url: championData.skinMain,
        },
      });
    }
  }
};
