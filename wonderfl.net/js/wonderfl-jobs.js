function offers(obj) {
    $('companyList').update(obj.offers);
}

if (typeof(Wonderfl) == "undefined") Wonderfl = {};
Wonderfl.Jobs = new function() {
    return {
        init : function() {
        },
        load : function() {
            var company_list = $('companyList');
            if (! company_list) { return; }
            company_list.insert(new Element('script', {
                src : 'http://flash-jobs.wonderfl.net/api/offer/random'
            }));
        }
    };
}

Wonderfl.Jobs.init();
document.observe("dom:loaded", Wonderfl.Jobs.load.bind(Wonderfl.Jobs));
