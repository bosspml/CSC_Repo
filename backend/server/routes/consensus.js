const express = require("express");
const axios = require("axios");

const router = express.Router();

const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";

const POLITICS_KEYWORDS = [
  "politics",
  "election",
  "president",
  "senate",
  "house",
  "congress",
  "governor",
  "democrat",
  "republican",
  "white house",
  "trump",
  "biden",
  "campaign",
  "primary",
  "vote",
  "voting",
  "mayor",
  "parliament",
  "prime minister"
];

function safeJsonParse(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeProbability(rawValue) {
  const value = Number(rawValue);

  if (!Number.isFinite(value)) return null;

  if (value <= 1) {
    return Number((value * 100).toFixed(2));
  }

  return Number(value.toFixed(2));
}

function getTextBlob(item) {
  return [
    item?.title,
    item?.question,
    item?.description,
    item?.slug,
    item?.category
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function looksPolitical(eventObj) {
  const text = getTextBlob(eventObj);
  return POLITICS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function getYesProbability(market) {
  const outcomes = safeJsonParse(market?.outcomes, []);
  const prices = safeJsonParse(market?.outcomePrices, []);

  if (outcomes.length < 2 || prices.length < 2) {
    return null;
  }

  const yesIndex = outcomes.findIndex(
    (outcome) => String(outcome).trim().toLowerCase() === "yes"
  );

  if (yesIndex === -1) {
    return null;
  }

  return normalizeProbability(prices[yesIndex]);
}

function extractChoiceLabel(eventObj, market) {
  const rawLabel =
    market?.question ||
    market?.title ||
    market?.slug ||
    "";

  const eventTitle = String(eventObj?.title || eventObj?.question || "").trim();
  let label = String(rawLabel).trim();

  if (!label) return null;

  // Example:
  // Event: "Claude 5 released by...?"
  // Market: "Will Claude 5 be released by June 30, 2026?"
  // Output: "June 30, 2026"
  const byMatch = label.match(/\bby\s+(.+?)\?*$/i);
  if (byMatch && byMatch[1]) {
    return byMatch[1].trim();
  }

  // Remove leading "Will"
  label = label.replace(/^will\s+/i, "").trim();

  // Remove trailing question marks
  label = label.replace(/\?+$/, "").trim();

  // If the event title text appears inside the label, remove it
  if (eventTitle) {
    const cleanedEventTitle = eventTitle
      .replace(/\.\.\.\?/g, "")
      .replace(/\?+$/g, "")
      .trim();

    if (cleanedEventTitle) {
      const escapedEventTitle = cleanedEventTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      label = label.replace(new RegExp(escapedEventTitle, "i"), "").trim();
    }
  }

  // Cleanup extra leading/trailing filler words after title removal
  label = label
    .replace(/^(be|is|are|will|would|does|do|did)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return label || rawLabel;
}

function shuffleArray(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function normalizeEventToQuestion(eventObj) {
  const markets = Array.isArray(eventObj?.markets) ? eventObj.markets : [];

  if (markets.length < 2) {
    return null;
  }

  const candidateChoices = markets
    .map((market) => {
      const yesProbability = getYesProbability(market);
      const label = extractChoiceLabel(eventObj, market);

      if (!label || yesProbability === null) {
        return null;
      }

      return {
        id: String(market.id),
        name: label,
        probability: yesProbability,
        image: market?.image || market?.icon || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.probability - a.probability);

  if (candidateChoices.length < 2) {
    return null;
  }

  const first = candidateChoices[0];
  const second = candidateChoices[1];

  if (first.probability === second.probability) {
    return null;
  }

  if (first.probability >= 95 || second.probability <= 5) {
    return null;
  }

  const gap = first.probability - second.probability;
  if (gap > 35) {
    return null;
  }

  const displayedAnswers = shuffleArray([first, second]);

  return {
    marketId: String(eventObj.id),
    question: eventObj.title || eventObj.question || "Political prediction",
    answers: displayedAnswers,
    correctAnswerId: first.id,
    category: "politics",
    fetchedAt: new Date().toISOString()
  };
}

function dedupeQuestions(questions) {
  const seen = new Set();

  return questions.filter((question) => {
    const key = question.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchActiveEvents() {
  const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
    params: {
      active: true,
      closed: false,
      limit: 100
    },
    timeout: 15000
  });

  return Array.isArray(response.data) ? response.data : [];
}

router.get("/question", async (req, res) => {
  try {
    const excludeIds = String(req.query.exclude || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const events = await fetchActiveEvents();

    // Optional debug:
    // console.log(JSON.stringify(events[0], null, 2));

    const questions = dedupeQuestions(
      events
        .filter((eventObj) => looksPolitical(eventObj))
        .map((eventObj) => normalizeEventToQuestion(eventObj))
        .filter(Boolean)
    ).filter((question) => !excludeIds.includes(question.marketId));

    if (questions.length === 0) {
      return res.status(404).json({
        message: "No valid politics questions are available right now."
      });
    }

    const randomIndex = Math.floor(Math.random() * questions.length);
    const randomQuestion = questions[randomIndex];

    return res.status(200).json(randomQuestion);
  } catch (error) {
    console.error("Consensus route error:", error.message);

    return res.status(500).json({
      message: "Unable to load a consensus question right now."
    });
  }
});

module.exports = router;