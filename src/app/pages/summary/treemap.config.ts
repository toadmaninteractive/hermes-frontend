export const data = [
    {
        type: 'treemap',

        labels: [
            'Artist',
            'Designer',
            'Intermidiate',
            'Junior',
            'Senior',
            'Intermidiate2',
            'Senior2'
        ],

        parents: ['', '', 'Artist', 'Artist', 'Artist', 'Designer', 'Designer'],

        values: [0, 0, 9, 1, 8, 6, 3],

        textinfo: 'label+value+percent parent+percent entry',

        domain: { x: [0, 0.48] },

        outsidetextfont: { size: 20, color: '#377eb8' },

        marker: { line: { width: 2 } },

        pathbar: { visible: false }
    }
];

export const layout = {
    annotations: [
        {
            showarrow: false,

            text: 'branchvalues: <b>remainder</b>',

            x: 0.25,

            xanchor: 'center',

            y: 1.1,

            yanchor: 'bottom'
        },
        {
            showarrow: false,

            text: 'branchvalues: <b>total</b>',

            x: 0.75,

            xanchor: 'center',

            y: 1.1,

            yanchor: 'bottom'
        }
    ]
};
