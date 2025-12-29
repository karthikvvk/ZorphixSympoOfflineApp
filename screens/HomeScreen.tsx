import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Event } from '../navigation/types';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
    navigation: HomeScreenNavigationProp;
};



const DUMMY_EVENTS: Event[] = [
    {
        id: '1',
        title: 'Paper Presentation',
        category: 'Technical',
        date: 'Oct 24, 2025',
        description: 'Present your innovative ideas and research papers to a panel of experts. A great platform to showcase your technical prowess.'
    },
    {
        id: '2',
        title: 'Hackathon',
        category: 'Technical',
        date: 'Oct 25, 2025',
        description: 'A 24-hour coding marathon where you solve real-world problems. forming teams of 3-4 members.'
    },
    {
        id: '3',
        title: 'Technical Quiz',
        category: 'Technical',
        date: 'Oct 24, 2025',
        description: 'Test your knowledge in various domains of computer science and engineering in this rapid-fire quiz event.'
    },
    {
        id: '4',
        title: 'Workshop on AI',
        category: 'Workshop',
        date: 'Oct 26, 2025',
        description: 'Hands-on workshop on Artificial Intelligence and Machine Learning basics. Bring your laptops!'
    },
    {
        id: '5',
        title: 'Gaming Event',
        category: 'Non-Technical',
        date: 'Oct 25, 2025',
        description: 'Compete in popular esports titles and win exciting prizes. Open to all gamers.'
    },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Technical': return '#B8860B'; // Dark Golden Rod
            case 'Workshop': return '#DAA520'; // Golden Rod
            case 'Non-Technical': return '#FFD700'; // Gold
            default: return '#95a5a6';
        }
    };

    const handleSync = () => {
        Alert.alert("Sync", "Sync with Firebase is coming soon!");
    };

    const renderEventItem = ({ item }: { item: Event }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <View style={[styles.badge, { borderColor: getCategoryColor(item.category) }]}>
                    <Text style={[styles.badgeText, { color: getCategoryColor(item.category) }]}>{item.category}</Text>
                </View>
            </View>
            <Text style={styles.eventDate}>{item.date}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.actionContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('DatabaseViewer')}>
                    <Text style={styles.actionButtonText}>View Database</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.syncButton]} onPress={handleSync}>
                    <Text style={styles.actionButtonText}>Sync Data</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={DUMMY_EVENTS}
                renderItem={renderEventItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    actionContainer: {
        flexDirection: 'row',
        padding: 16,
        justifyContent: 'space-between'
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#FFD700',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 10
    },
    syncButton: {
        marginRight: 0,
        marginLeft: 10
    },
    actionButtonText: {
        color: '#FFD700',
        fontWeight: 'bold'
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginLeft: 10,
        borderWidth: 1,
        backgroundColor: 'transparent'
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    eventDate: {
        fontSize: 14,
        color: '#888',
    },
});

export default HomeScreen;
