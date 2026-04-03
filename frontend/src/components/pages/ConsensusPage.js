import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import "./consensus.css";

const SESSION_KEY = "consensus-game-state";
const QUESTION_TIME = 20;
const POINTS_PER_CORRECT = 10;

function getSavedGame() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
}

export default function ConsensusPage() {
  const savedGame = getSavedGame();

  const [score, setScore] = useState(savedGame?.score || 0);
  const [question, setQuestion] = useState(savedGame?.question || null);
  const [selectedAnswerId, setSelectedAnswerId] = useState(savedGame?.selectedAnswerId || null);
  const [result, setResult] = useState(savedGame?.result || null);
  const [timeLeft, setTimeLeft] = useState(savedGame?.timeLeft || QUESTION_TIME);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [roundOver, setRoundOver] = useState(savedGame?.roundOver || false);
  const [usedMarketIds, setUsedMarketIds] = useState(savedGame?.usedMarketIds || []);

  const timerRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        score,
        question,
        selectedAnswerId,
        result,
        timeLeft,
        roundOver,
        usedMarketIds
      })
    );
  }, [score, question, selectedAnswerId, result, timeLeft, roundOver, usedMarketIds]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(QUESTION_TIME);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setResult("wrong");
          setRoundOver(true);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const fetchQuestion = useCallback(
    async (resetUsed = false) => {
      try {
        stopTimer();
        setIsLoading(true);
        setError("");
        setSelectedAnswerId(null);
        setResult(null);

        const excludeList = resetUsed ? [] : usedMarketIds;

        const response = await axios.get("http://localhost:8081/api/consensus/question", {
          params: {
            exclude: excludeList.join(",")
          }
        });

        const newQuestion = response.data;

        setQuestion(newQuestion);
        setRoundOver(false);
        setUsedMarketIds((prev) =>
          resetUsed ? [newQuestion.marketId] : [...prev, newQuestion.marketId]
        );

        startTimer();
      } catch (err) {
        setError(err?.response?.data?.message || "Could not load a question.");
      } finally {
        setIsLoading(false);
      }
    },
    [usedMarketIds, startTimer, stopTimer]
  );

  useEffect(() => {
    if (!question) {
      fetchQuestion();
    }

    return () => stopTimer();
  }, [question, fetchQuestion, stopTimer]);

  const handleAnswerClick = (answerId) => {
    if (!question || selectedAnswerId || roundOver) return;

    stopTimer();
    setSelectedAnswerId(answerId);

    const isCorrect = answerId === question.correctAnswerId;

    if (isCorrect) {
      setResult("correct");
      setScore((prev) => prev + POINTS_PER_CORRECT);
    } else {
      setResult("wrong");
      setRoundOver(true);
    }
  };

  const handleNextQuestion = async () => {
    await fetchQuestion();
  };

  const handleSkip = async () => {
    if (isLoading || roundOver) return;
    await fetchQuestion();
  };

  const handleRestart = async () => {
    stopTimer();
    setScore(0);
    setQuestion(null);
    setSelectedAnswerId(null);
    setResult(null);
    setTimeLeft(QUESTION_TIME);
    setError("");
    setRoundOver(false);
    setUsedMarketIds([]);
    sessionStorage.removeItem(SESSION_KEY);

    await fetchQuestion(true);
  };

  const getAnswerClass = (answer) => {
    let className = "consensus-answer";

    if (result) {
      if (answer.id === question.correctAnswerId) {
        className += " correct";
      } else if (answer.id === selectedAnswerId && result === "wrong") {
        className += " wrong";
      }
    }

    return className;
  };

  return (
    <div className="consensus-page">
      <div className="consensus-container">
        <div className="consensus-topbar">
          <div className="consensus-title">Consensus</div>
          <div className="consensus-score">Score: {score}</div>
          <div className={`consensus-timer ${timeLeft <= 5 ? "danger" : ""}`}>
            {timeLeft}s
          </div>
        </div>

        {isLoading && <p className="consensus-message">Loading question...</p>}
        {error && <p className="consensus-message error">{error}</p>}

        {question && !isLoading && (
          <>
            <div className="consensus-question-box">
              <h1>{question.question}</h1>
            </div>

            <div className="consensus-answers-grid">
              {question.answers.map((answer) => (
                <button
                  key={answer.id}
                  className={getAnswerClass(answer)}
                  onClick={() => handleAnswerClick(answer.id)}
                  disabled={!!selectedAnswerId || roundOver}
                >
                  {answer.image ? (
                    <>
                      <img
                        src={answer.image}
                        alt={answer.name}
                        className="consensus-answer-image"
                      />
                      <span>{answer.name}</span>
                    </>
                  ) : (
                    <span>{answer.name}</span>
                  )}

                  {result && (
                    <small className="consensus-probability">{answer.probability}%</small>
                  )}
                </button>
              ))}
            </div>

            <div className="consensus-actions">
              {!result && !roundOver && (
                <button className="consensus-secondary-button" onClick={handleSkip}>
                  Skip
                </button>
              )}

              {result === "correct" && !roundOver && (
                <>
                  <div className="consensus-feedback correct">Correct! +10 points</div>
                  <button className="consensus-primary-button" onClick={handleNextQuestion}>
                    Next Question
                  </button>
                </>
              )}

              {roundOver && (
                <>
                  <div className="consensus-feedback wrong">Wrong. Final Score: {score}</div>
                  <button className="consensus-primary-button" onClick={handleRestart}>
                    Play Again
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}