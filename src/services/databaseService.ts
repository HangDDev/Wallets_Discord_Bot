import * as admin from 'firebase-admin';
import { Logger } from '../utils/logger';

interface UserLink {
    discordId: string;
    appUserId: string;
    email: string;
    linkedAt: Date;
}

export class DatabaseService {
    private static instance: DatabaseService;
    private db: admin.firestore.Firestore;
    private isInitialized = false;

    private constructor() {
        this.db = {} as admin.firestore.Firestore;
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            Logger.debug('Firebase already initialized, skipping...');
            return;
        }

        try {
            const serviceAccount = {
                type: "service_account",
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
            };

            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
                });
                Logger.success('Firebase Admin SDK initialized');
            }

            this.db = admin.firestore();

            if (admin.apps.length === 1) {
                this.db.settings({ ignoreUndefinedProperties: true });
            }

            await this.db.collection('users').limit(1).get();

            this.isInitialized = true;
            Logger.success('Database connection verified and ready');
        } catch (error) {
            Logger.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    // Helper function to convert Firestore data to proper types
    private convertFirestoreData(data: any): any {
        if (!data) return data;

        // Handle Firestore Timestamp
        if (data instanceof admin.firestore.Timestamp) {
            return data.toDate();
        }

        // Handle objects
        if (typeof data === 'object' && !Array.isArray(data)) {
            const converted: any = {};
            for (const [key, value] of Object.entries(data)) {
                converted[key] = this.convertFirestoreData(value);
            }
            return converted;
        }

        // Handle arrays
        if (Array.isArray(data)) {
            return data.map(item => this.convertFirestoreData(item));
        }

        return data;
    }

    // User linking methods with proper data conversion
    public async linkUser(discordId: string, appUserId: string, email: string): Promise<void> {
        const userLink: UserLink = {
            discordId,
            appUserId,
            email,
            linkedAt: new Date()
        };

        await this.db.collection('discordLinks').doc(discordId).set(userLink);
    }

    public async getUserLink(discordId: string): Promise<UserLink | null> {
        try {
            const doc = await this.db.collection('discordLinks').doc(discordId).get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data();
            if (!data) {
                return null;
            }

            // Convert Firestore data to proper types
            return {
                discordId: data.discordId as string,
                appUserId: data.appUserId as string,
                email: data.email as string,
                linkedAt: this.convertFirestoreData(data.linkedAt) || new Date()
            };
        } catch (error) {
            Logger.error('Error getting user link:', error);
            return null;
        }
    }

    public async unlinkUser(discordId: string): Promise<void> {
        await this.db.collection('discordLinks').doc(discordId).delete();
    }

    // Finance data methods with proper data conversion
    public async getUserTransactions(userId: string, limit: number = 50): Promise<any[]> {
        try {
            Logger.debug(`Querying transactions in subcollection for userId: ${userId}`);

            const snapshot = await this.db
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .orderBy('date', 'desc')
                .limit(limit)
                .get();

            Logger.debug(`Found ${snapshot.size} transactions in subcollection`);

            const transactions = snapshot.docs.map(doc => {
                const data = doc.data();
                const convertedData = this.convertFirestoreData(data);
                Logger.debug(`Transaction: ${convertedData.amount} - ${convertedData.description}`);
                return { id: doc.id, ...convertedData };
            });

            return transactions;
        } catch (error) {
            Logger.error('Error in getUserTransactions:', error);
            return [];
        }
    }

    public async getBorrowLendRecords(userId: string, type?: string): Promise<any[]> {
        try {
            Logger.debug(`Querying borrow_lend in subcollection for userId: ${userId}, type: ${type}`);

            let query = this.db
                .collection('users')
                .doc(userId)
                .collection('borrow_lend')  // Changed from borrowLend to borrow_lend
                .orderBy('date', 'desc');

            if (type) {
                query = query.where('type', '==', type) as any;
            }

            const snapshot = await query.get();
            Logger.debug(`Found ${snapshot.size} borrow_lend records in subcollection`);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                const convertedData = this.convertFirestoreData(data);
                Logger.debug(`BorrowLend: ${convertedData.amount} - ${convertedData.personName} - ${convertedData.type}`);
                return { id: doc.id, ...convertedData };
            });
        } catch (error) {
            Logger.error('Error in getBorrowLendRecords:', error);
            return [];
        }
    }

    public async getUserBalance(userId: string): Promise<{ total: number; byMethod: any }> {
        const transactions = await this.getUserTransactions(userId, 1000);

        const balanceByMethod: { [key: string]: number } = {};
        let total = 0;

        transactions.forEach(transaction => {
            const method = transaction.paymentMethod || 'UNKNOWN';
            const amount = transaction.isExpense ? -transaction.amount : transaction.amount;

            balanceByMethod[method] = (balanceByMethod[method] || 0) + amount;
            total += amount;
        });

        return { total, byMethod: balanceByMethod };
    }

// Add method to check if user has any data in subcollections
    public async checkUserDataExists(userId: string): Promise<{
        hasTransactions: boolean;
        hasBorrowLend: boolean;
        transactionCount: number;
        borrowLendCount: number;
    }> {
        try {
            const transactionsSnapshot = await this.db
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .limit(1)
                .get();

            const borrowLendSnapshot = await this.db
                .collection('users')
                .doc(userId)
                .collection('borrow_lend')  // Changed from borrowLend to borrow_lend
                .limit(1)
                .get();

            return {
                hasTransactions: !transactionsSnapshot.empty,
                hasBorrowLend: !borrowLendSnapshot.empty,
                transactionCount: transactionsSnapshot.size,
                borrowLendCount: borrowLendSnapshot.size
            };
        } catch (error) {
            Logger.error('Error checking user data exists:', error);
            return {
                hasTransactions: false,
                hasBorrowLend: false,
                transactionCount: 0,
                borrowLendCount: 0
            };
        }
    }

    public async addTransaction(userId: string, transactionData: any): Promise<void> {
        await this.db.collection('transactions').add({
            ...transactionData,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    // Debug method with proper data conversion
    public async debugUserData(appUserId: string): Promise<void> {
        try {
            Logger.debug(`=== DEBUG DATA FOR USER: ${appUserId} ===`);

            // Check transactions
            const transactions = await this.getUserTransactions(appUserId);
            Logger.debug(`Found ${transactions.length} transactions for user ${appUserId}`);
            transactions.forEach((data, index) => {
                Logger.debug(`Transaction ${index + 1}: ${data.amount} - ${data.description} - ${data.isExpense ? 'Expense' : 'Income'}`);
            });

            // Check borrow/lend records
            const borrowLend = await this.getBorrowLendRecords(appUserId);
            Logger.debug(`Found ${borrowLend.length} borrow/lend records for user ${appUserId}`);
            borrowLend.forEach((data, index) => {
                Logger.debug(`BorrowLend ${index + 1}: ${data.amount} - ${data.personName} - ${data.type} - Settled: ${data.isSettled}`);
            });

            // Check user document
            const userDoc = await this.db.collection('users').doc(appUserId).get();
            Logger.debug(`User document exists: ${userDoc.exists}`);

        } catch (error) {
            Logger.error('Error in debugUserData:', error);
        }
    }

    public async findUserDataByMultipleFields(discordUserId: string): Promise<{
        possibleUserIds: string[];
        transactions: any[];
        borrowLend: any[];
    }> {
        try {
            const userLink = await this.getUserLink(discordUserId);
            if (!userLink) {
                return { possibleUserIds: [], transactions: [], borrowLend: [] };
            }

            const linkedUserId = userLink.appUserId;
            const possibleUserIds = [linkedUserId];

            // Try different variations of the user ID
            // Sometimes Firebase Auth IDs can have different formats
            if (linkedUserId.includes('.')) {
                possibleUserIds.push(linkedUserId.replace(/\./g, ''));
            }

            // Try email as user ID (some apps use email instead of UID)
            possibleUserIds.push(userLink.email);

            console.log(`🔍 Searching for data with possible user IDs:`, possibleUserIds);

            let allTransactions: any[] = [];
            let allBorrowLend: any[] = [];

            // Try each possible user ID
            for (const userId of possibleUserIds) {
                try {
                    const transactions = await this.getUserTransactions(userId, 50);
                    const borrowLend = await this.getBorrowLendRecords(userId);

                    if (transactions.length > 0) {
                        console.log(`✅ Found ${transactions.length} transactions with user ID: ${userId}`);
                        allTransactions = [...allTransactions, ...transactions];
                    }

                    if (borrowLend.length > 0) {
                        console.log(`✅ Found ${borrowLend.length} borrow/lend records with user ID: ${userId}`);
                        allBorrowLend = [...allBorrowLend, ...borrowLend];
                    }
                } catch (error) {
                    console.log(`❌ No data found with user ID: ${userId}`);
                }
            }

            return {
                possibleUserIds,
                transactions: allTransactions,
                borrowLend: allBorrowLend
            };
        } catch (error) {
            console.error('Error in findUserDataByMultipleFields:', error);
            return { possibleUserIds: [], transactions: [], borrowLend: [] };
        }
    }

    public async getAllUserIdsInDatabase(): Promise<string[]> {
        try {
            const userIds = new Set<string>();

            // Get user IDs from transactions
            const transactionsSnapshot = await this.db
                .collection('transactions')
                .select('userId')
                .get();

            transactionsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.userId) {
                    userIds.add(data.userId);
                }
            });

            // Get user IDs from borrowLend
            const borrowLendSnapshot = await this.db
                .collection('borrowLend')
                .select('userId')
                .get();

            borrowLendSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.userId) {
                    userIds.add(data.userId);
                }
            });

            return Array.from(userIds);
        } catch (error) {
            console.error('Error getting all user IDs:', error);
            return [];
        }
    }
}