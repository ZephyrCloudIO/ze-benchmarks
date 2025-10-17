import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface OracleAnswers {
	[key: string]: string;
}

export class Oracle {
	private answers: OracleAnswers;
	private questionsAsked: Array<{ question: string; answer: string }> = [];

	constructor(answersPath: string) {
		if (!existsSync(answersPath)) {
			throw new Error(`Oracle answers file not found: ${answersPath}`);
		}
		this.answers = JSON.parse(readFileSync(answersPath, 'utf8'));
	}

	/**
	 * Get answer for a question from the oracle
	 * Uses fuzzy matching to find the best answer key
	 */
	ask(question: string): string {
		// Normalize question for matching
		const normalizedQuestion = question.toLowerCase().trim();

		// Try exact match first
		if (this.answers[normalizedQuestion]) {
			const answer = this.answers[normalizedQuestion];
			this.questionsAsked.push({ question, answer });
			return answer;
		}

		// Try fuzzy matching by key similarity
		const keys = Object.keys(this.answers);
		for (const key of keys) {
			const normalizedKey = key.toLowerCase().replace(/[_-]/g, ' ');
			if (normalizedQuestion.includes(normalizedKey) || normalizedKey.includes(normalizedQuestion.slice(0, 20))) {
				const answer = this.answers[key];
				this.questionsAsked.push({ question, answer });
				return answer;
			}
		}

		// Default answer if no match found
		const defaultAnswer = "Proceed with your best judgment based on the constraints provided.";
		this.questionsAsked.push({ question, answer: defaultAnswer });
		return defaultAnswer;
	}

	/**
	 * Get all questions asked during the session
	 */
	getQuestionLog(): Array<{ question: string; answer: string }> {
		return [...this.questionsAsked];
	}

	/**
	 * Get the number of questions asked
	 */
	getQuestionCount(): number {
		return this.questionsAsked.length;
	}
}

