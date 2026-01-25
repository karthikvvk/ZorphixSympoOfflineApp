import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function TeamScannerLauncher({ navigation }: any) {
    const [teamName, setTeamName] = useState('');
    const [teamSize, setTeamSize] = useState('2');

    const handleStartTeamScan = () => {
        if (!teamName.trim()) {
            Alert.alert('Team Name Required', 'Please enter a team name before starting verification.');
            return;
        }

        const size = parseInt(teamSize);
        if (isNaN(size) || size < 1 || size > 10) {
            Alert.alert('Invalid Team Size', 'Team size must be between 1 and 10.');
            return;
        }

        navigation.navigate('QRScanner', {
            mode: 'TEAM',
            teamSize: size,
            teamName: teamName.trim()
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Team Verification Setup</Text>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Team Name *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter team name (e.g., Team Alpha)"
                    placeholderTextColor="#666"
                    value={teamName}
                    onChangeText={setTeamName}
                    autoCapitalize="words"
                />
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Team Size *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Number of members"
                    placeholderTextColor="#666"
                    value={teamSize}
                    onChangeText={setTeamSize}
                    keyboardType="number-pad"
                    maxLength={2}
                />
            </View>

            <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartTeamScan}
            >
                <Text style={styles.startButtonText}>Start Team Verification</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.individualButton}
                onPress={() => navigation.navigate('QRScanner', { mode: 'INDIVIDUAL' })}
            >
                <Text style={styles.individualButtonText}>Individual Scan Instead</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        padding: 20,
        justifyContent: 'center'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        textAlign: 'center',
        marginBottom: 40
    },
    inputContainer: {
        marginBottom: 20
    },
    label: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 15,
        color: '#fff',
        fontSize: 16
    },
    startButton: {
        backgroundColor: '#FFD700',
        paddingVertical: 16,
        borderRadius: 8,
        marginTop: 20
    },
    startButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    individualButton: {
        marginTop: 15,
        paddingVertical: 12
    },
    individualButtonText: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center'
    }
});