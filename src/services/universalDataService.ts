import { DatabaseService } from './databaseService';
import { Logger } from '../utils/logger';

export class UniversalDataService {
    private dbService: DatabaseService;

    constructor() {
        this.dbService = DatabaseService.getInstance();
    }

    public async findUserFinancialData(discordUserId: string): Promise<{
        transactions: any[];
        borrowLend: any[];
        userStructure: any;
        dataLocation: string;
    }> {
        const userLink = await this.dbService.getUserLink(discordUserId);
        if (!userLink) {
            return { transactions: [], borrowLend: [], userStructure: null, dataLocation: 'not_linked' };
        }

        Logger.debug(`🔍 Universal search for user: ${userLink.appUserId}`);

        // Try multiple data location strategies
        const strategies = [
            await this.tryStandardCollections(userLink.appUserId),
            await this.tryUserSubcollections(userLink.appUserId),
            await this.tryDifferentCollectionNames(userLink.appUserId),
            await this.tryDirectUserDocument(userLink.appUserId)
        ];

        // Find the first strategy that returned data
        const successfulStrategy = strategies.find(strategy =>
            strategy.transactions.length > 0 || strategy.borrowLend.length > 0
        );

        if (successfulStrategy) {
            Logger.debug(`✅ Found data using strategy: ${successfulStrategy.dataLocation}`);
            return successfulStrategy;
        }

        // If no data found, return the first strategy for debugging
        return {
            ...strategies[0],
            dataLocation: 'not_found'
        };
    }

    private async tryStandardCollections(userId: string): Promise<any> {
        Logger.debug(`Trying standard collections for user: ${userId}`);

        const transactions = await this.dbService.getUserTransactions(userId);
        const borrowLend = await this.dbService.getBorrowLendRecords(userId);

        return {
            transactions,
            borrowLend,
            userStructure: null,
            dataLocation: 'standard_collections'
        };
    }

    private async tryUserSubcollections(userId: string): Promise<any> {
        Logger.debug(`Trying user subcollections for user: ${userId}`);

        try {
            // Some apps store data in user subcollections: users/{userId}/transactions
            const transactionsSnapshot = await this.dbService['db']
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .get();

            const borrowLendSnapshot = await this.dbService['db']
                .collection('users')
                .doc(userId)
                .collection('borrow_lend')  // Changed from borrowLend to borrow_lend
                .get();

            const transactions = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const borrowLend = borrowLendSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return {
                transactions,
                borrowLend,
                userStructure: 'subcollections',
                dataLocation: 'user_subcollections'
            };
        } catch (error) {
            Logger.debug('User subcollections not found');
            return { transactions: [], borrowLend: [], userStructure: null, dataLocation: 'user_subcollections_failed' };
        }
    }

    private async tryDifferentCollectionNames(userId: string): Promise<any> {
        Logger.debug(`Trying different collection names for user: ${userId}`);

        // Common alternative collection names
        const collectionVariations = [
            { transactions: 'Transactions', borrowLend: 'borrow_lend' }, // Updated to match your structure
            { transactions: 'transaction', borrowLend: 'borrow_lend' },
            { transactions: 'expenses', borrowLend: 'loans' },
            { transactions: 'financial_transactions', borrowLend: 'debt_records' }
        ];

        for (const variation of collectionVariations) {
            try {
                const transactionsSnapshot = await this.dbService['db']
                    .collection(variation.transactions)
                    .where('userId', '==', userId)
                    .get();

                const borrowLendSnapshot = await this.dbService['db']
                    .collection(variation.borrowLend)
                    .where('userId', '==', userId)
                    .get();

                const transactions = transactionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const borrowLend = borrowLendSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                if (transactions.length > 0 || borrowLend.length > 0) {
                    return {
                        transactions,
                        borrowLend,
                        userStructure: null,
                        dataLocation: `collection_names: ${variation.transactions}/${variation.borrowLend}`
                    };
                }
            } catch (error) {
                // Collection doesn't exist, try next variation
                continue;
            }
        }

        return { transactions: [], borrowLend: [], userStructure: null, dataLocation: 'alternative_names_not_found' };
    }

    private async tryDirectUserDocument(userId: string): Promise<any> {
        Logger.debug(`Trying direct user document for user: ${userId}`);

        try {
            const userDoc = await this.dbService['db'].collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                // Check if transactions are stored as an array in the user document
                const embeddedTransactions = userData?.transactions || userData?.transactionHistory || [];
                const embeddedBorrowLend = userData?.borrowLend || userData?.loans || userData?.debts || [];

                return {
                    transactions: Array.isArray(embeddedTransactions) ? embeddedTransactions : [],
                    borrowLend: Array.isArray(embeddedBorrowLend) ? embeddedBorrowLend : [],
                    userStructure: 'embedded_data',
                    userData: userData,
                    dataLocation: 'user_document_embedded'
                };
            }

            return { transactions: [], borrowLend: [], userStructure: null, dataLocation: 'user_document_not_found' };
        } catch (error) {
            return { transactions: [], borrowLend: [], userStructure: null, dataLocation: 'user_document_error' };
        }
    }

    public async exploreAllCollections(): Promise<{ [key: string]: any[] }> {
        const collections = await this.dbService['db'].listCollections();
        const result: { [key: string]: any[] } = {};

        for (const collection of collections) {
            try {
                const snapshot = await collection.get();
                result[collection.id] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                result[collection.id] = [];
            }
        }

        return result;
    }
}